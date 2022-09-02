package main

import (
	"fmt"
	"github.com/conductor-sdk/conductor-go/sdk/model"
	"github.com/stretchr/testify/assert"
	"quickstart/workflow"
	"testing"
	"time"
)

func TestWorkflowExecution(t *testing.T) {
	wf := workflow.NewSimpleWorkflow(workflowExecutor)
	err := wf.Register(true)
	assert.NoError(t, err)

	id, err := wf.StartWorkflowWithInput(&workflow.NameAndCity{
		Name: "Conductor",
		City: "New York",
	})
	assert.NoError(t, err)
	assert.NotEmpty(t, id)

	taskRunner.StartWorker("task1", workflow.Task1, 1, time.Second*1)
	taskRunner.StartWorker("task2", workflow.Task2, 1, time.Second*1)

	channel, err := workflowExecutor.MonitorExecution(id)
	assert.NoError(t, err)

	workflowRun := <-channel
	assert.NotEmpty(t, workflowRun)
	assert.Equal(t, model.CompletedWorkflow, workflowRun.Status)

	greetings := workflowRun.Output["Greetings"]
	assert.NotNil(t, greetings)
	fmt.Println("Greetings: ", greetings)

}
