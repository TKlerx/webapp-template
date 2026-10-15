package cmd

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAuditCommandsPreserveAnonymousAndKnownActors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/audit" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"data": []map[string]any{
			{"id": "anonymous", "action": "AUTH_LOGIN_REJECTED", "actorId": nil, "details": "rejected anonymously"},
			{"id": "known", "action": "USER_CREATED", "actorId": "admin-1"},
		}})
	}))
	defer server.Close()
	t.Setenv("STARTERCTL_CONFIG_DIR", t.TempDir())
	t.Setenv("STARTERCTL_SERVER_URL", server.URL)
	t.Setenv("STARTERCTL_TOKEN", "test-token")
	oldOut, oldErr, oldFormat := stdout, stderr, formatFlag
	t.Cleanup(func() { SetIO(oldOut, oldErr); formatFlag = oldFormat })

	for _, operation := range []string{"list", "export"} {
		t.Run(operation, func(t *testing.T) {
			var out bytes.Buffer
			SetIO(&out, &out)
			formatFlag = "json"
			command := newAuditListCommand()
			if operation == "export" {
				command = newAuditExportCommand()
			}
			if err := command.Execute(); err != nil {
				t.Fatal(err)
			}
			var rows []map[string]any
			if err := json.Unmarshal(out.Bytes(), &rows); err != nil {
				t.Fatal(err)
			}
			if len(rows) != 2 || rows[0]["actorId"] != nil || rows[1]["actorId"] != "admin-1" {
				t.Fatalf("actor values changed: %s", out.String())
			}
			if rows[0]["details"] != "rejected anonymously" {
				t.Fatalf("audit details were lost: %s", out.String())
			}
		})
	}
	var out bytes.Buffer
	SetIO(&out, &out)
	formatFlag = "csv"
	if err := newAuditListCommand().Execute(); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "Anonymous") || !strings.Contains(out.String(), "admin-1") {
		t.Fatalf("actor labels missing: %s", out.String())
	}
}
