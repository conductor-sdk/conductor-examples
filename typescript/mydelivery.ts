import {
  TaskRunner,
  ConductorClient,
  generate,
  TaskType,
  WorkflowDef,
  RunnerArgs,
} from "@io-orkes/conductor-typescript";

export const calculateDistanceWorkflow: WorkflowDef = generate({
  name: "calculate_distance",
  inputParameters: ["from", "to", "identity"],
  tasks: [
    {
      name: "calculate_distance",
      type: TaskType.INLINE,
      inputParameters: {
        fromLatitude: "${workflow.input.from.latitude}",
        fromLongitude: "${workflow.input.from.longitude}",
        toLatitude: "${workflow.input.to.latitude}",
        toLongitude: "${workflow.input.to.longitude}",
        expression: function ($: any) {
          return function () {
            function degreesToRadians(degrees: any) {
              return (degrees * Math.PI) / 180;
            }
            function harvisineManhatam(elem: any) {
              var EARTH_RADIUS = 6371;
              var a = Math.pow(Math.sin(elem / 2), 2); // sin^2(delta/2)
              var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // 2* atan2(sqrt(a),sqrt(1-a))

              return EARTH_RADIUS * c;
            }

            var deltaLatitude = Math.abs(
              degreesToRadians($.fromLatitude) - degreesToRadians($.toLatitude)
            );
            var deltaLongitude = Math.abs(
              degreesToRadians($.fromLongitude) -
                degreesToRadians($.toLongitude)
            );

            var latitudeDistance = harvisineManhatam(deltaLatitude);
            var longitudeDistance = harvisineManhatam(deltaLongitude);

            return {
              distance:
                Math.abs(latitudeDistance) + Math.abs(longitudeDistance),
            };
          };
        },
      },
    },
  ],
  outputParameters: {
    distance: "${calculate_distance_ref.output.result.distance}",
    identity: "${workflow.input.identity}",
  },
});

export const workflowDotMap = generate({
  name: "workflowDotMap",
  inputParameters: ["inputArray", "mapperWorkflowId"],
  tasks: [
    {
      type: TaskType.JSON_JQ_TRANSFORM,
      name: "count",
      taskReferenceName: "count_ref",
      inputParameters: {
        input: "${workflow.input.inputArray}",
        queryExpression: ".[] | length",
      },
    },
    {
      type: TaskType.JSON_JQ_TRANSFORM,
      name: "dyn_task_builder",
      taskReferenceName: "dyn_task_builder_ref",
      inputParameters: {
        input: {},
        queryExpression:
          'reduce range(0,${count_ref.output.result}) as $f (.;  .dynamicTasks[$f].subWorkflowParam.name = "${workflow.input.mapperWorkflowId}" | .dynamicTasks[$f].taskReferenceName = "mapperWorkflow_wf_ref_\\($f)" | .dynamicTasks[$f].type = "SUB_WORKFLOW")',
      },
    },
    {
      type: TaskType.JSON_JQ_TRANSFORM,
      name: "dyn_input_params_builder",
      taskReferenceName: "dyn_input_params_builder_ref",
      inputParameters: {
        taskList: "${dyn_task_builder_ref.output.result}",
        input: "${workflow.input.inputArray}",
        queryExpression:
          'reduce range(0,${count_ref.output.result}) as $f (.; .dynamicTasksInput."mapperWorkflow_wf_ref_\\($f)" = .input[$f])',
      },
    },
    {
      type: TaskType.FORK_JOIN_DYNAMIC,
      inputParameters: {
        dynamicTasks: "${dyn_task_builder_ref.output.result.dynamicTasks}",
        dynamicTasksInput:
          "${dyn_input_params_builder_ref.output.result.dynamicTasksInput}",
      },
    },
    {
      type: TaskType.JOIN,
      name: "join",
      taskReferenceName: "join_ref",
    },
    {
      type:TaskType.JSON_JQ_TRANSFORM,
      name:"to_array",
      inputParameters:{
        objValues:"${join_ref.output}",
        queryExpression:".objValues | to_entries | map(.value)"
      }
    }
  ],
  outputParameters: {
    outputArray: "${to_array_ref.output.result}",
  },
});

export const nearByRiders = generate({
  name: "findNearByRiders",
  inputParameters: ["place"],
  tasks: [
    {
      type: TaskType.HTTP,
      name: "get_users",
      taskReferenceName: "get_users_ref",
      inputParameters: {
        http_request: {
          uri: "http://dummyjson.com/users",
          method: "GET",
        },
      },
    },
    {
      type: TaskType.JSON_JQ_TRANSFORM,
      name: "summarize",
      inputParameters: {
        users: "${get_users_ref.output.response.body.users}",
        queryExpression:
          ".users | map({identity:{id,email}, to:{latitude:.address.coordinates.lat, longitude:.address.coordinates.lng}} + {from:{latitude:${workflow.input.place.latitude},longitude:${workflow.input.place.latitude}}})",
      },
    },
    {
      type: TaskType.SUB_WORKFLOW,
      name: "distance_to_riders",
      subWorkflowParam: {
        name: "workflowDotMap",
        version: 1,
      },
      inputParameters: {
        inputArray: "${summarize_ref.output.result}",
        mapperWorkflowId: "calculate_distance",
      },
    },
    {
      type: TaskType.JSON_JQ_TRANSFORM,
      name: "riders_picker",
      taskReferenceName: "riders_picker_ref",
      inputParameters: {
        ridersWithDistance: "${distance_to_riders_ref.output.outputArray}",
        queryExpression:
          ".ridersWithDistance | map( {distance:.distance, rider:.identity}) | sort_by(.distance) ",
      },
    },
  ],
  outputParameters: {
    possibleRiders: "${riders_picker_ref.output.result}",
  },
});

export const pickRider = generate({
  name: "pickRider",
  inputParameters: ["targetRiders", "maxCompetingRiders"],
  tasks: [
    {
      name: "do_while",
      taskReferenceName: "do_while_ref",
      type: TaskType.DO_WHILE,
      inputParameters: {
        amountOfCompetingRiders: "${workflow.input.maxCompetingRiders}",
        riders: "${workflow.input.targetRiders}",
      },
      loopCondition: "$.do_while_ref['iteration'] < $.amountOfCompetingRiders",
      loopOver: [
        {
          taskReferenceName: "assigner_ref",
          type: TaskType.INLINE,
          inputParameters: {
            riders: "${workflow.input.targetRiders}",
            currentIteration: "${do_while_ref.output.iteration}",
            expression: ($: {
              riders: {
                distance: number;
                rider: { id: number; email: string };
              }[];
              currentIteration: number;
            }) =>
              function () {
                var currentRider = $.riders[$.currentIteration - 1];
                return {
                  distance: currentRider.distance,
                  riderId: currentRider.rider.id,
                  riderEmail: currentRider.rider.email,
                };
              },
          },
        },
        {
          type: TaskType.HTTP,
          name: "notify_riders_of_ride",
          taskReferenceName: "notify_riders_of_ride",
          inputParameters: {
            http_request: {
              uri: "http://dummyjson.com/posts/add",
              method: "POST",
              body: {
                title:
                  "Are you availabe to take a ride of a distance of ${assigner_ref.output.result.distance} km  from you",
                userId: "${assigner_ref.output.result.riderId}",
              },
            },
          },
        },
      ],
    },
    {
      type: TaskType.SIMPLE,
      name: "rider_race",
      inputParameters: {
        riders: "${workflow.input.targetRiders}",
      },
    },
  ],
  outputParameters: {
    selectedRider: "${rider_race_ref.output.selectedRider}",
  },
});

export const deliveryWorkflow = generate({
  name: "deliveryWorkflow",
  inputParameters: ["origin", "packageDestination", "client", "paymentMethod"],
  tasks: [
    {
      taskReferenceName: "possible_riders_ref",
      type: TaskType.SUB_WORKFLOW,
      subWorkflowParam: {
        version: nearByRiders.version,
        name: nearByRiders.name,
      },
      inputParameters: {
        place: "${workflow.input.origin}",
      },
    },
    {
      taskReferenceName: "pick_a_rider_ref",
      type: TaskType.SUB_WORKFLOW,
      subWorkflowParam: {
        version: pickRider.version,
        name: pickRider.name,
      },
      inputParameters: {
        targetRiders: "${possible_riders_ref.output.possibleRiders}",
        maxCompetingRiders: 5,
      },
    },
    {
      taskReferenceName: "calculate_package_distance_ref",
      type: TaskType.SUB_WORKFLOW,
      subWorkflowParam: {
        version: calculateDistanceWorkflow.version,
        name: calculateDistanceWorkflow.name,
      },
      inputParameters: {
        from: "${workflow.input.origin}",
        to: "${workflow.input.packageDestination}",
        identity: "commonPackage",
      },
    },
    {
      type: TaskType.SWITCH,
      name: "compute_total_cost",
      evaluatorType: "value-param",
      inputParameters: {
        value: "${workflow.input.paymentMethod}",
      },
      expression: "value",
      decisionCases: {
        card: [
          {
            type: TaskType.INLINE,
            taskReferenceName: "card_price_ref",
            inputParameters: {
              distance: "${calculate_package_distance_ref.output.distance}",
              expression: ($: { distance: number }) =>
                function () {
                  return $.distance * 20 + 20;
                },
            },
          },
          {
            type: TaskType.SET_VARIABLE,
            inputParameters: {
              totalPrice: "${card_price_ref.output.result}",
            },
          },
        ],
      },
      defaultCase: [
        {
          type: TaskType.INLINE,
          taskReferenceName: "non_card_price_ref",
          inputParameters: {
            distance: "${calculate_package_distance_ref.output.distance}",
            expression: ($: { distance: number }) =>
              function () {
                return $.distance * 40 + 20;
              },
          },
        },
        {
          type: TaskType.SET_VARIABLE,
          inputParameters: {
            totalPrice: "${non_card_price_ref.output.result}",
          },
        },
      ],
    },
  ],
  outputParameters: {
    rider: "${pick_a_rider_ref.output.selectedRider}",
    totalPrice: "${workflow.variables.totalPrice}",
  },
});

export const createRiderRaceDefintion = (client: ConductorClient) =>
  client.metadataResource.registerTaskDef([
    {
      name: "rider_race",
      description: "Rider race",
      retryCount: 3,
      timeoutSeconds: 3600,
      timeoutPolicy: "TIME_OUT_WF",
      retryLogic: "FIXED",
      retryDelaySeconds: 60,
      responseTimeoutSeconds: 600,
      rateLimitPerFrequency: 0,
      rateLimitFrequencyInSeconds: 1,
      ownerEmail: "james.stuart@orkes.io",
      pollTimeoutSeconds: 3600,
    },
  ]);

export const riderRespondWorkerRunner = (client: ConductorClient) => {
  const firstRidertoRespondWorker: RunnerArgs = {
    taskResource: client.taskResource,
    worker: {
      taskDefName: "rider_race",
      execute: async ({ inputData }) => {
        const riders = inputData?.riders;
        const [aRider] = riders.sort(() => 0.5 - Math.random());
        return {
          outputData: {
            selectedRider: aRider.rider,
          },
          status: "COMPLETED",
        };
      },
    },
    options: {
      pollInterval: 10,
      domain: undefined,
      concurrency: 1,
      workerID: "",
    },
  };
  const taskManager = new TaskRunner(firstRidertoRespondWorker);
  return taskManager;
};
