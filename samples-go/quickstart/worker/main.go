package main

import (
	"github.com/conductor-sdk/conductor-go/sdk/client"
	"github.com/conductor-sdk/conductor-go/sdk/settings"
	"github.com/conductor-sdk/conductor-go/sdk/worker"
	"github.com/conductor-sdk/conductor-go/sdk/workflow/executor"
	"github.com/sirupsen/logrus"
	"os"
	"quickstart/workflow"
	"time"
)

var (
	apiClient = client.NewAPIClient(
		settings.NewAuthenticationSettings(
			os.Getenv("KEY"),
			os.Getenv("SECRET"),
		),
		settings.NewHttpSettings(
			os.Getenv("CONDUCTOR_SERVER_URL"),
		))
	taskRunner       = worker.NewTaskRunnerWithApiClient(apiClient)
	workflowExecutor = executor.NewWorkflowExecutor(apiClient)
	metadataClient   = client.MetadataResourceApiService{APIClient: apiClient}
)

func main() {
	taskRunner.StartWorker("task1", workflow.Task1, 1, time.Millisecond*100)
	taskRunner.StartWorker("task2", workflow.Task2, 1, time.Millisecond*100)

	logrus.Info("Started Workers")

	taskRunner.WaitWorkers()

}
