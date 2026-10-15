package config

import (
	"os"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

func TestSaveProtectsNewAndExistingConfigACL(t *testing.T) {
	t.Setenv("STARTERCTL_CONFIG_DIR", t.TempDir())
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		t.Fatal(err)
	}
	for _, existing := range []bool{false, true} {
		if existing {
			permissive, err := windows.SecurityDescriptorFromString("D:(A;;FA;;;WD)")
			if err != nil {
				t.Fatal(err)
			}
			dacl, _, err := permissive.DACL()
			if err != nil {
				t.Fatal(err)
			}
			if err := windows.SetNamedSecurityInfo(ConfigPath(), windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION|windows.UNPROTECTED_DACL_SECURITY_INFORMATION, nil, nil, dacl, nil); err != nil {
				t.Fatal(err)
			}
		}
		if err := Save(&Config{ServerURL: "https://example.com", Token: "test-secret"}); err != nil {
			t.Fatal(err)
		}
		descriptor, err := windows.GetNamedSecurityInfo(ConfigPath(), windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
		if err != nil {
			t.Fatal(err)
		}
		dacl, _, err := descriptor.DACL()
		if err != nil || dacl == nil || dacl.AceCount != 1 {
			t.Fatalf("config must have exactly one access grant: %v, %v", dacl, err)
		}
		control, _, err := descriptor.Control()
		if err != nil || control&windows.SE_DACL_PROTECTED == 0 {
			t.Fatalf("config inherits permissions: %v, %v", control, err)
		}
		if !strings.Contains(descriptor.String(), "(A;;FA;;;"+user.User.Sid.String()+")") {
			t.Fatalf("unexpected config ACL: %s", descriptor.String())
		}
	}
}

func TestSaveDoesNotTruncateLockedConfig(t *testing.T) {
	t.Setenv("STARTERCTL_CONFIG_DIR", t.TempDir())
	const original = "original-content"
	if err := os.WriteFile(ConfigPath(), []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}
	file, err := os.Open(ConfigPath())
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := Save(&Config{Token: "replacement"}); err == nil {
		t.Fatal("expected a sharing violation")
	}
	body, err := os.ReadFile(ConfigPath())
	if err != nil || string(body) != original {
		t.Fatalf("locked config was changed: %q, %v", body, err)
	}
}
