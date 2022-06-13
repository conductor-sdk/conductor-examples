//  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
//  the License. You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.

package main

import (
	"fmt"
	"github.com/conductor-sdk/conductor-go/sdk/client"
	"github.com/conductor-sdk/conductor-go/sdk/model"
	"github.com/conductor-sdk/conductor-go/sdk/settings"
	"github.com/conductor-sdk/conductor-go/sdk/worker"
	"github.com/conductor-sdk/conductor-go/sdk/workflow"
	"github.com/conductor-sdk/conductor-go/sdk/workflow/executor"
	"time"
)

var (
	apiClient = client.NewAPIClient(
		settings.NewAuthenticationSettings(
			"4ea35902-3452-4378-af28-d6cca5ec67f8",
			"2ngFfe0ySJty3zzJnz0TD13sUZnDnMOvUSJwJ6ZPT7IKwBqx",
		),
		settings.NewHttpSettings(
			"https://tw-perf.conductorworkflow.net//api",
		))

	taskRunner = worker.NewTaskRunnerWithApiClient(apiClient)

	workflowExecutor = executor.NewWorkflowExecutor(apiClient)
)

type Address struct {
	Name    string
	Address []string
	Country string
}

type ShippingCost struct {
	Amount float32
}

func NewSimpleWorkflow() *workflow.ConductorWorkflow {

	wf := workflow.NewConductorWorkflow(workflowExecutor).
		Name("my_first_workflow").
		Version(1).
		Description("My First Workflow").
		TimeoutPolicy(workflow.TimeOutWorkflow, 60)

	//Create a task that calculates the shipping cost
	calculateShipmentCost := workflow.NewSimpleTask("shipping_cost_cal", "shipping_cost_calc").
		Input("address", "${workflow.input.address}").
		Description("Calculates the cost of shipping based on the address")

	//Add two simple tasks
	wf.
		Add(calculateShipmentCost).
		OutputParameters(calculateShipmentCost.OutputRef(""))

	return wf
}

func CalculateShippingCost(task *model.Task) (interface{}, error) {
	return &ShippingCost{Amount: 101}, nil
}

func StartWorkers() {
	taskRunner.StartWorker("shipping_cost_cal", CalculateShippingCost, 1, time.Second*1)
}

func main() {
	StartWorkers()

	wf := NewSimpleWorkflow()
	err := wf.Register(true)
	if err != nil {
		fmt.Println(err.Error())
		return
	}
	id, err := wf.StartWorkflowWithInput(map[string]interface{}{})
	if err != nil {
		fmt.Println(err.Error())
		return
	}

	fmt.Println("Started workflow with Id: ", id)
	channel, _ := workflowExecutor.MonitorExecution(id)
	run := <-channel

	fmt.Println("Output of the workflow, ", run.Status)
	state, _ := workflowExecutor.GetWorkflowStatus(id, true, true)
	
	fmt.Println("Workflow State is ", state)
	amount := state.Output["Amount"]
	fmt.Println("Amount is ", amount)

}
