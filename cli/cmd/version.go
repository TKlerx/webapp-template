package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/TKlerx/webapp-template/cli/internal/client"
	"github.com/TKlerx/webapp-template/cli/internal/config"
)

func newVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:     "version",
		Short:   "Show CLI and server version information",
		Example: "starterctl version",
		RunE: func(_ *cobra.Command, _ []string) error {
			fmt.Fprintf(stdout, "starterctl %s\n", version)

			cfg, err := config.Load()
			if err != nil {
				return err
			}
			if cfg.ServerURL == "" || cfg.Token == "" {
				return nil
			}

			httpClient := client.NewClient(cfg)
			httpClient.SetVerbose(verboseFlag)
			httpClient.SetStderr(stderr)
			fmt.Fprintf(stdout, "server %s\n", cfg.ServerURL)
			fmt.Fprintf(stdout, "server_version %s\n", serverVersion(httpClient))
			return nil
		},
	}
}

func serverVersion(httpClient *client.Client) string {
	response, err := httpClient.Get("/api/version")
	if err == nil {
		var metadata struct {
			Version string `json:"version"`
		}
		if response.DecodeJSON(&metadata) == nil && metadata.Version != "" {
			return metadata.Version
		}
	}
	return "unknown"
}
