package main

import (
	"fmt"
	"github.com/conductor-sdk/conductor-go/sdk/model"
	"github.com/stretchr/testify/assert"
	"testing"
	"time"
)

func TestWorkflowExecution(t *testing.T) {
	wf := NewSimpleWorkflow()
	err := wf.Register(true)
	assert.NoError(t, err)

	id, err := wf.StartWorkflowWithInput(&WorkflowInput{
		Name: "Conductor",
		City: "New York",
	})
	assert.NoError(t, err)
	assert.NotEmpty(t, id)

	taskRunner.StartWorker("task1", Task1, 1, time.Second*1)
	taskRunner.StartWorker("task2", Task2, 1, time.Second*1)

	channel, err := workflowExecutor.MonitorExecution(id)
	assert.NoError(t, err)

	workflowRun := <-channel
	assert.NotEmpty(t, workflowRun)
	assert.Equal(t, model.CompletedWorkflow, workflowRun.Status)

	greetings := workflowRun.Output["Greetings"]
	assert.NotNil(t, greetings)
	fmt.Println("Greetings: ", greetings)

}

func Worker(task *model.Task) (interface{}, error) {
	return map[string]interface{}{
		"Amount": 203,
	}, nil
}
