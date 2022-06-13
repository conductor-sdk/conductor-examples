package main

import (
	"github.com/conductor-sdk/conductor-go/sdk/model"
	"github.com/stretchr/testify/assert"
	"testing"
	"time"
)

func TestWorkflowExecution(t *testing.T) {
	wf := NewSimpleWorkflow()
	err := wf.Register(true)
	assert.NoError(t, err)

	id, err := wf.StartWorkflowWithInput(map[string]interface{}{})
	assert.NoError(t, err)
	assert.NotEmpty(t, id)

	taskRunner.StartWorker("shipping_cost_cal", Worker, 1, time.Second*1)
	channel, err := workflowExecutor.MonitorExecution(id)
	assert.NoError(t, err)

	workflowRun := <-channel
	assert.NotEmpty(t, workflowRun)
	assert.Equal(t, model.CompletedWorkflow, workflowRun.Status)

	amount := workflowRun.Output["Amount"]
	assert.NotNil(t, amount)
	assert.Equal(t, float64(203), amount)

}

func Worker(task *model.Task) (interface{}, error) {
	return map[string]interface{}{
		"Amount": 203,
	}, nil
}
