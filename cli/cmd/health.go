package cmd

import (
	"fmt"
	"net/http"

	"github.com/spf13/cobra"

	"github.com/TKlerx/webapp-template/cli/internal/client"
	"github.com/TKlerx/webapp-template/cli/internal/output"
)

type healthPayload struct {
	Status  string `json:"status"`
	Version string `json:"version"`
	Checks  struct {
		Database struct {
			Status string `json:"status"`
		} `json:"database"`
		Process struct {
			Status string `json:"status"`
		} `json:"process"`
	} `json:"checks"`
}

func newHealthCommand() *cobra.Command {
	return &cobra.Command{
		Use:     "health",
		Short:   "Check server health",
		Example: "starterctl health\n" + "starterctl health --format json",
		RunE: func(_ *cobra.Command, _ []string) error {
			cfg, err := requireConfiguredClient()
			if err != nil {
				return err
			}

			httpClient := client.NewClient(cfg)
			httpClient.SetVerbose(verboseFlag)
			httpClient.SetStderr(stderr)
			resp, err := httpClient.GetAcceptingStatus("/api/health", http.StatusServiceUnavailable)
			if err != nil {
				return err
			}

			payload := healthPayload{}
			if err := resp.DecodeJSON(&payload); err != nil {
				return err
			}
			payload.Version = "unknown"
			if resp.StatusCode == http.StatusOK {
				payload.Version = serverVersion(httpClient)
			}

			renderer := output.NewRenderer(output.Options{
				Format:      formatFlag,
				Stdout:      stdout,
				Stderr:      stderr,
				Interactive: output.IsInteractiveWriter(stdout),
			})
			switch renderer.Format() {
			case output.FormatJSON:
				err = renderer.RenderData(payload)
			case output.FormatCSV:
				err = renderer.RenderTable([]string{"Status", "Database", "Process", "Version"}, [][]string{{payload.Status, payload.Checks.Database.Status, payload.Checks.Process.Status, payload.Version}})
			default:
				_, err = fmt.Fprintf(stdout, "status=%s database=%s process=%s version=%s\n", payload.Status, payload.Checks.Database.Status, payload.Checks.Process.Status, payload.Version)
			}
			if err != nil {
				return err
			}
			if resp.StatusCode == http.StatusServiceUnavailable {
				return &client.AppError{Message: "server health check is degraded", Code: 1}
			}
			return nil
		},
	}
}
