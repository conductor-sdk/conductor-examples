//  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
//  the License. You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.

package shipment_example

import (
	"github.com/conductor-sdk/conductor-go/sdk/model"
	"github.com/conductor-sdk/conductor-go/sdk/workflow/definition"
	"github.com/conductor-sdk/conductor-go/sdk/workflow/executor"
)

var TaskCalculateTaxAndTotal = definition.NewSimpleTask("calculate_tax_and_total", "calculate_tax_and_total").
	Input("orderDetail", "${workflow.input.orderDetail}")

var TaskChargePayment = definition.NewSimpleTask("charge_payment", "charge_payment").
	InputMap(
		map[string]interface{}{
			"billingId":   "${workflow.input.userDetails.billingId}",
			"billingType": "${workflow.input.userDetails.billingType}",
			"amount":      "${calculate_tax_and_total.output.total_amount}",
		},
	)

var (
	shippingLabelInputMap = map[string]interface{}{
		"name":    "${workflow.input.userDetails.name}",
		"address": "${workflow.input.userDetails.addressLine}",
		"orderNo": "${workflow.input.orderDetails.orderNumber}",
	}

	TaskGroundShippingLabel  = definition.NewSimpleTask("ground_shipping_label", "ground_shipping_label").InputMap(shippingLabelInputMap)
	SameDayShippingLabel     = definition.NewSimpleTask("same_day_shipping_label", "same_day_shipping_label").InputMap(shippingLabelInputMap)
	AirShippingLabel         = definition.NewSimpleTask("air_shipping_label", "air_shipping_label").InputMap(shippingLabelInputMap)
	UnsupportedShippingLabel = definition.NewTerminateTask("unsupported_shipping_type", model.FailedWorkflow, "Unsupported Shipping Method")

	TaskShippingLabel = definition.NewSwitchTask("shipping_label", "${workflow.input.orderDetail.shippingMethod}").
				SwitchCase(string(Ground), TaskGroundShippingLabel).
				SwitchCase(string(SameDay), SameDayShippingLabel).
				SwitchCase(string(NextDayAir), AirShippingLabel).
				DefaultCase(UnsupportedShippingLabel)
)

var TaskSendEmail = definition.NewSimpleTask("send_email", "send_email").
	InputMap(
		map[string]interface{}{
			"name":    "${workflow.input.userDetails.name}",
			"email":   "${workflow.input.userDetails.email}",
			"orderNo": "${workflow.input.orderDetails.orderNumber}",
		},
	)

var TaskGetOrderDetails = definition.NewSimpleTask("get_order_details", "get_order_details").
	Input("orderNo", "${workflow.input.orderNo}")

var TaskGetUserDetails = definition.NewSimpleTask("get_user_details", "get_user_details").
	Input("userId", "${workflow.input.userId}")

var TaskGetInParallel = definition.NewForkTask(
	"get_in_parallel",
	[]definition.TaskInterface{
		TaskGetOrderDetails, TaskGetUserDetails,
	},
)

var (
	TaskGenerateDynamicFork = definition.NewSimpleTask("generateDynamicFork", "generateDynamicFork").
				InputMap(
			map[string]interface{}{
				"orderDetails": TaskGetOrderDetails.OutputRef("result"),
				"userDetails":  TaskGetUserDetails.OutputRef(""),
			},
		)

	TaskProcessOrder = definition.NewDynamicForkTask("process_order", TaskGenerateDynamicFork)
)

var TaskUpdateState = definition.NewSetVariableTask("update_state").
	Input("shipped", true)

func NewOrderWorkflow(workflowExecutor *executor.WorkflowExecutor) *definition.ConductorWorkflow {
	return definition.NewConductorWorkflow(workflowExecutor).
		Name("example_go_order_workflow").
		Version(1).
		OwnerEmail("developers@orkes.io").
		TimeoutPolicy(definition.TimeOutWorkflow, 60).
		Description("Workflow to track order").
		Add(TaskCalculateTaxAndTotal).
		Add(TaskChargePayment).
		Add(TaskShippingLabel).
		Add(TaskSendEmail)
}

func NewShipmentWorkflow(workflowExecutor *executor.WorkflowExecutor) *definition.ConductorWorkflow {
	return definition.NewConductorWorkflow(workflowExecutor).
		Name("example_go_shipment_workflow").
		Version(1).
		OwnerEmail("developers@orkes.io").
		Variables(NewShipmentState()).
		TimeoutPolicy(definition.TimeOutWorkflow, 60).
		Description("Workflow to track shipment").
		Add(TaskGetInParallel).
		Add(TaskProcessOrder).
		Add(TaskUpdateState)
}
