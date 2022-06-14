package main

import (
	"context"
	"fmt"
	"github.com/conductor-sdk/conductor-go/sdk/client"
	"github.com/conductor-sdk/conductor-go/sdk/model"
	"github.com/conductor-sdk/conductor-go/sdk/settings"
	"github.com/conductor-sdk/conductor-go/sdk/worker"
	"github.com/conductor-sdk/conductor-go/sdk/workflow"
	"github.com/conductor-sdk/conductor-go/sdk/workflow/executor"
	log "github.com/sirupsen/logrus"
	"os"
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

//WorkflowInput struct that represents the input to the workflow
type WorkflowInput struct {
	Name string
	City string
}

func init() {
	//Logrus is used for logging
	log.SetFormatter(&log.JSONFormatter{})
	log.SetOutput(os.Stdout)
	log.SetLevel(log.InfoLevel)

	//Register task definitions with the server.
	taskDefs := []model.TaskDef{
		model.TaskDef{Name: "task1"},
		model.TaskDef{Name: "task2"},
	}
	metadataClient.RegisterTaskDef(context.Background(), taskDefs)
}

//NewSimpleWorkflow Create a simple 2-step workflow and register it with the server
func NewSimpleWorkflow() *workflow.ConductorWorkflow {

	wf := workflow.NewConductorWorkflow(workflowExecutor).
		Name("simple_workflow").
		Version(1).
		Description("Simple Two Step Workflow").
		TimeoutPolicy(workflow.TimeOutWorkflow, 600)

	//Task1
	task1 := workflow.NewSimpleTask("task1", "task1").
		Input("name", "${workflow.input.Name}")

	//Task 2
	task2 := workflow.NewSimpleTask("task2", "task2").
		Input("city", "${workflow.input.City}")

	//Add two simple tasks
	wf.
		Add(task1).
		Add(task2)

	//Add the output of the workflow from the two tasks
	wf.OutputParameters(map[string]interface{}{
		"Greetings": task1.OutputRef("greetings"),
		"ZipCode":   task2.OutputRef("zip"),
	})

	return wf
}

//Task1 worker for Task1
func Task1(task *model.Task) (interface{}, error) {
	return map[string]interface{}{
		"greetings": "Hello, " + fmt.Sprintf("%v", task.InputData["name"]),
	}, nil
}

//Task2 worker for Task2
func Task2(task *model.Task) (interface{}, error) {
	return map[string]interface{}{
		"zip": "10121",
	}, nil
}
