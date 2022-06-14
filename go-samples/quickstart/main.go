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
	"encoding/json"
	"fmt"
	"github.com/conductor-sdk/conductor-go/sdk/client"
	"github.com/conductor-sdk/conductor-go/sdk/settings"
	"github.com/conductor-sdk/conductor-go/sdk/worker"
	"github.com/conductor-sdk/conductor-go/sdk/workflow/executor"
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

func StartWorkers() {
	taskRunner.StartWorker("task1", workflow.Task1, 1, time.Millisecond*100)
	taskRunner.StartWorker("task2", workflow.Task2, 1, time.Millisecond*100)
}

func main() {

	//Start the workers
	StartWorkers()

	wf := workflow.NewSimpleWorkflow(workflowExecutor)
	err := wf.Register(true)
	if err != nil {
		fmt.Println(err.Error())
		return
	}
	id, err := wf.StartWorkflowWithInput(&workflow.NameAndCity{
		Name: "Conductor",
		City: "NYC",
	})
	if err != nil {
		fmt.Println(err.Error())
		return
	}

	fmt.Println("Started workflow with Id: ", id)
	channel, _ := workflowExecutor.MonitorExecution(id)
	run := <-channel

	fmt.Println("Output of the workflow, ", run.Status)
	state, _ := workflowExecutor.GetWorkflowStatus(id, true, true)
	output, err := json.Marshal(state.Output)

	fmt.Println("Workflow Output is ", string(output))

}
