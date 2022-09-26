# BUILDING A DELIVERY WORKFLOW WITH TS

So lets imagine we want to build a delivery workflow. For the purpose of this exercise we will imagine that we get a request from our fakeDeliveryApp user that wants to send a package from an origin to a package destination. We as an app that has both registered clients and registered riders (people willing to take our package for a fee) will be in charge to connect the best fitting rider to do the job.
For this we will pull our registered riders. pick the best candidates (the ones most near to our package) and let them compete to win the ride.

Im of course oversimplifying, The intent is to show the use of conductor as a way of building an application with small constructs or blocks. Achieving by this not only a working app but documentation for free, Since the end application can be seen as a nice diagram that describes the flow of our state and the interaction of the pieces

## What we need

- Registered Riders.
- A way to let our riders know they have a possible delivery
- a way for our riders to "compete" or be the first one to select the ride.

### "Materials"

To simulate some api calls we will use `http://dummyjson.com` dummy json provides us with fake apis. We will use the user api to simulate the pulling of our registered riders. And the posts api to simulate notifying the rider that he has a ride nearby.

Since we are going to create this workflow as code. Instead of using the diagram. lets try to start with the Test and build our workflow app from the ground up. For the exercise I will be using Orkes Play. A free conductor playground `https://play.orkes.io/`. But the same applies for netflix conductor, only you wont need to specify the credentials.

In my case I will create an application under the Application menu. Then edit. Then just toggle all permissions to on and copy both appKey and secret from the window.

## Workflow as code

## Project setup

Create an npm project with `npm init` answer the questions and then install the sdk with `npm i @io-orkes/conductor-javascript`.
You'll need to add jest and typescript support for this just copy paste the jest.config.js, tsconfig.json file into your project and add the following devDependencies:

```json
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "@tsconfig/node16": "^1.0.2",
    "@types/jest": "^29.0.3",
    "@types/node": "^17.0.30",
    "@types/node-fetch": "^2.6.1",
    "@typescript-eslint/eslint-plugin": "^5.23.0",
    "@typescript-eslint/parser": "^5.23.0",
    "eslint": "^6.1.0",
    "jest": "^28.1.0",
    "ts-jest": "^28.0.1",
    "ts-node": "^10.7.0",
    "typescript": "^4.6.4"
  },
```

and `yarn` to fetch them

## Getting started

Since we will be creating the workflow as code let's create two files mydelivery.ts and mydelivery.test.ts. By writing our code along with the test, we will get instant feedback and know exactly what's going on, on every save.

### Creating our workflow

So for our workflow to work. We will need to calculate the distance between two points. We are going to calculate the distance between the riders to the package (origin). We also want to know the distance between origin to destination to calculate the price. So lets create a workflow that just does that. that way we have a really simple workflow we can just test. and we can reuse in both situations.

But first... lets just create a workflow that outputs the result of some function. So in our mydelivery.ts lets do the following:

```typescript
import {
  generate,
  TaskType,
  OrkesApiConfig,
} from "@io-orkes/conductor-javascript";

export const playConfig: Partial<OrkesApiConfig> = {
  keyId: "50b75bb9-665f-42a3-ba19-6eeb83e4c5d5",
  keySecret: "Grp9REao2mQqGoBVSo15c8Ud3k0gVxvrPw9pBmgu7N3wVaJY",
  serverUrl: "https://play.orkes.io/api",
};
export const calculateDistanceWF = generate({
  name: "calculate_distance",
  inputParameters: ["origin", "destination"],
  tasks: [
    {
      type: TaskType.INLINE,
      name: "calculate_distance",
      inputParameters: {
        expression: "12",
      },
    },
  ],
  outputParameters: {
    distance: "${calculate_distance_ref.output.result}",
    identity: "${workflow.input.identity}", // Some identifier for the call will make sense latter on
  },
});
```

Now in our test file lets create a test that just creates the workflow. So that we can later look at it on Play.

```typescript
import {
  orkesConductorClient,
  WorkflowExecutor,
} from "@io-orkes/conductor-javascript";
import { calculateDistanceWF, playConfig } from "./mydelivery";

describe("My Delivery Test", () => {
  const clientPromise = orkesConductorClient(playConfig);
  describe("Calculate distance workflow", () => {
    test("Creates a workflow", async () => {
      // const client = new ConductorClient(); // If you are using netflix conductor
      const client = await clientPromise;
      const workflowExecutor = new WorkflowExecutor(client);
      await expect(
        workflowExecutor.registerWorkflow(true, calculateDistanceWF)
      ).resolves.not.toThrowError();
      console.log(JSON.stringify(calculateDistanceWF, null, 2));
    });
  });
});
```

Run `npm test`. We just created our first workflow, which basically prints the output of its task. If you look at the generated json. you'll notice that there are some attributes we did not put that are being printed. Thats because the `generate` function will generate default/fake values that we will be overwriting. You'll also notice that on the output I used "${calculate_distance_ref.output.distance}" using the generated taskReferenceName. if you don't specify a taskReferenceName it will generate one by just adding `_ref` to the specified name. To reference a task output or a given task we always use the `taskReferenceName`. Another thing to notice is the true passed as the first argument of the registerWorkflow function. This flag specifies that the workflow will be overwritten. Which is what we want since we will be running our tests over and over again.

Lets create a test to actually run the workflow now. im adding origin and destination parameters which as we know by the workflow definition. We are not using for now. and im adding the test within our previous describe block.

```typescript
test("Should calculate distance", async () => {
  // Just picked two random points.
  const origin = {
    latitude: -34.4810097,
    longitude: -58.4972602,
  };

  const destination = {
    latitude: -34.4810097,
    longitude: -58.491168,
  };
  // const client = new ConductorClient(); // If you are using netflix conductor
  const client = await clientPromise;
  const workflowExecutor = new WorkflowExecutor(client);
  // Run the workflow passing an origin and a destination
  const executionId = await workflowExecutor.startWorkflow({
    name: calculateDistanceWF.name,
    version: 1,
    input: {
      origin,
      destination,
    },
  });
  const workflowStatus = await workflowExecutor.getWorkflow(executionId, true);

  expect(workflowStatus?.status).toEqual("COMPLETED");
  // for now we expect the output of our workflow to be our hardcoded value.
  expect(workflowStatus?.output?.distance).toBe(12);
});
```

Run `yarn test`. Great we have our first workflow execution run!.

## Calculating the real distance.

So what we want is something that calculates the real distance. or an approximate distance between the two points. To get the distance between two points in a sphere we can use Havesine(http://www.movable-type.co.uk/scripts/latlong.html) but since we don't want a direct distance because our riders cant fly :P we are going to implement something like https://en.wikipedia.org/wiki/Taxicab_geometry

## The INLINE TASKS

For tasks that require really simple code. An INLINE task can take inputParameters where we will map our context from our workflow input parameters, and an expression where we can make use of this context in javascript.
If we go back to our `calculate_distance` workflow takes no context. and returns a hardcoded object. Lets modify our inline task to take the origin and destination into its context. and calculate the approximate distance.

```typescript
export const calculateDistanceWF = generate({
  name: "calculate_distance",
  inputParameters: ["origin", "destination"],
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
            /**
             * Converts from degrees to Radians
             */
            function degreesToRadians(degrees: any) {
              return (degrees * Math.PI) / 180;
            }
            /**
             *
             * Returns total latitude/longitud distance distance
             *
             */
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

            return Math.abs(latitudeDistance) + Math.abs(longitudeDistance);
          };
        },
      },
    },
  ],
  outputParameters: {
    distance: "${calculate_distance_ref.output.result}",
  },
});
```

If we run the tests, the tests are going to fail because the result is not 12. But Red-Green-Refactor If we pick two cardinal points we do know the Taxicab distance. we should make it pass. I picked same origin and same destination
so the result is 0 it is actually `.toEqual(0)` since im returning an object. So we can fix that in the test

**Note** The following from above. I was able to type ES5 javascript on my editor. Not as a string. However you can't use closures and the returned function, has to be written in ES5. Else our tests will fail.

If we run our tests now a workflow is registered. overwriting the old one. Then we are running the workflow and we get a result.

## Finding the best Rider.

Now that we have the calculate_distance workflow, we can think of this WF as a function we can latter import into a different project/file. Lets create our workflow number two. This workflow will simulate hitting a microservice that pulls our registered riders. We will latter pick from our riders list the best suited riders for the job.

### Hitting our fake microservice.

To hit something simple as an HTTP microservice we can use the HTTP Task. The Http Task will take some inputParameters and hit an endpoint with our configuration. It is similar to Curl or POSTMAN. We will be using `http://dummyjson.com/users` which returns a list of users with an address. We will think of this address as the last reported address from our rider.

```typescript
export const nearByRiders = generate({
  name: "findNearByRiders",
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
  ],
  outputParameters: {
    possibleRiders: "${get_users_ref.output.response.body.users}",
  },
});
```

Our findNearByRiders hits an endpoint and returns all available riders. Lets write the test.

```typescript
describe("NearbyRiders", () => {
  // As before we create the workflow.
  test("Creates a workflow", async () => {
    const client = await clientPromise;
    const workflowExecutor = new WorkflowExecutor(client);

    await expect(
      workflowExecutor.registerWorkflow(true, nearByRiders)
    ).resolves.not.toThrowError();
  });

  test("Should return all users with latest reported address", async () => {
    const client = await clientPromise;
    const workflowExecutor = new WorkflowExecutor(client);
    const executionId = await workflowExecutor.startWorkflow({
      name: nearByRiders.name,
      input: {
        place: {
          latitude: -34.4810097,
          longitude: -58.4972602,
        },
      },
      version: 1,
    });
    // Lets wait for the response...
    await new Promise((r) => setTimeout(() => r(true), 2000));
    const workflowStatus = await client.workflowResource.getExecutionStatus(
      executionId,
      true
    );
    expect(workflowStatus.status).toBe("COMPLETED");
    expect(workflowStatus?.output?.possibleRiders.length).toBeGreaterThan(0);
    console.log("Riders", JSON.stringify(workflowStatus?.output, null, 2));
  });
});
```

If we run our test. The test should pass since the amount of users. is like 30. And if we look at the printed output. we can see the whole structure being returned by the endpoint.

Our workflow is not yet complete since we are only interested in the distance from the riders to the package. This workflow is returning every possible rider. To get the distance from the package for every rider. We would like to run our previous workflow. for every rider we have on the list. Lets do this by first preparing our data. so that it can be passed to the next workflow. To do this we can use the JQ Task. Which let us run a JQ query over json data.

## JSON_JQ_TRANSFORM Task.

Lets add the JQ task.

```typescript
export const nearByRiders = generate({
  name: "findNearByRiders",
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
  ],
  outputParameters: {
    possibleRiders: "${get_users_ref.output.response.body.users}",
  },
});
```

From the above task definition you can see Im mapping into my JQ `users` context variable the output of the HTTP task and then extracting the address. The expected result should have the structure {identity:{id,email}, to:{latitude,longitude}, from:{latitude,longitude}}. Leaving us with the expected parameters for the calculate_distance workflow.

## dot Map

So we now have an array containing all possible riders and a workflow which calculates the distance between two points. What we are looking for is to aggregate, The distance of the rider to the package. This way we can select the riders which are nearer to the package. In javascript when we find ourselves in the position of aggregating, or changing the data for every item in the array we usually use the map method which takes a function that will be applied to ever item of the array.

Since we extracted our Calculate distance to a WF. We need to map our riders through this "function". Lets create a dotMap workflow to do this. This WF will take as inputParameters the array of riders and a workflow id of the calculate_distance to run on each rider. **Note** That this workflow will work for every array and workflow_id provided, not just the riders and the calculate_distance WF.

```typescript
describe("Mapper Test", () => {
  test("Creates a workflow", async () => {
    const client = await clientPromise;
    await expect(
      client.metadataResource.create(workflowDotMap, true)
    ).resolves.not.toThrowError();
  });

  test("Gets existing workflow", async () => {
    const client = await clientPromise;
    const wf = await client.metadataResource.get(workflowDotMap.name);
    expect(wf.name).toEqual(workflowDotMap.name);
    expect(wf.version).toEqual(workflowDotMap.version);
  });

  test("Can map over an array using a workflow", async () => {
    const client = await clientPromise;
    const workflowExecutor = new WorkflowExecutor(client);

    const from = {
      latitude: -34.4810097,
      longitude: -58.4972602,
    };
    const to = {
      latitude: -34.494858,
      longitude: -58.491168,
    };

    const executionId = await workflowExecutor.startWorkflow({
      name: workflowDotMap.name,
      version: 1,
      input: {
        inputArray: [{ from, to, identity: "js@js.com" }],
        mapperWorkflowId: "calculate_distance",
      },
    });

    await new Promise((r) => setTimeout(() => r(true), 1300));

    const workflowStatus = await client.workflowResource.getExecutionStatus(
      executionId,
      true
    );
    expect(workflowStatus?.status).toBe("COMPLETED");
    expect(workflowStatus?.output?.outputArray).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          distance: 2.2172824347556963,
        }),
      ])
    );
  });
});
```

The workflow :

```typescript
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
      type: TaskType.JSON_JQ_TRANSFORM,
      name: "to_array",
      inputParameters: {
        objValues: "${join_ref.output}",
        queryExpression: ".objValues | to_entries | map(.value)",
      },
    },
  ],
  outputParameters: {
    outputArray: "${to_array_ref.output.result}",
  },
});
```

### FORK_JOIN_DYNAMIC

In the above workflow we are getting the amount of the array, Then at "dyn_task_builder" we create a SubWorkflow task template for every item in the array. At "dyn_input_params_builder" we prepare the parameters that will be passed on to each SubWorkflow.

Using FORK_JOIN_DYNAMIC we create each task using our previously created template. and pass each corresponding parameter. After the join we use a JSON_JQ_TRANSFORM task to extract the results and return an array with the transformations.

## Near by riders

Given that we now have the package origin, the package destination. Lets modify our NearbyRiders wf so that that using the riders last reported location, will return the distance from the rider to the origin of the package. To do this we will simulate we are pulling the riders from our riders microservice. Calculate the distance to the package. and sort them according to the distance to the package.

```typescript
describe("NearbyRiders", () => {
  // As before we create the workflow.
  test("Creates a workflow", async () => {
    const client = await clientPromise;
    const workflowExecutor = new WorkflowExecutor(client);

    await expect(
      workflowExecutor.registerWorkflow(true, nearByRiders)
    ).resolves.not.toThrowError();
  });

  // First lets just test that the api responds with all the users.
  test("Should return all users with latest reported address", async () => {
    const client = await clientPromise;
    const workflowExecutor = new WorkflowExecutor(client);
    const executionId = await workflowExecutor.startWorkflow({
      name: nearByRiders.name,
      input: {
        place: {
          latitude: -34.4810097,
          longitude: -58.4972602,
        },
      },
      version: 1,
    });
    // Lets wait for the response...
    await new Promise((r) => setTimeout(() => r(true), 2000));
    const workflowStatus = await client.workflowResource.getExecutionStatus(
      executionId,
      true
    );
    expect(workflowStatus.status).toBe("COMPLETED");
    expect(workflowStatus?.output?.possibleRiders.length).toBeGreaterThan(0);
  });

  // So now we need to specify inputParameters else we wont know the distance to the package
  test("User object should contain distance to package", async () => {
    const client = await clientPromise;

    const workflowExecutor = new WorkflowExecutor(client);

    const executionId = await workflowExecutor.startWorkflow({
      name: nearByRiders.name,
      input: {
        place: {
          latitude: -34.4810097,
          longitude: -58.4972602,
        },
      },
      version: 1,
    });
    // Lets wait for the response...
    await new Promise((r) => setTimeout(() => r(true), 2000));

    const nearbyRidersWfResult =
      await client.workflowResource.getExecutionStatus(executionId, true);

    expect(nearbyRidersWfResult.status).toBe("COMPLETED");
    nearbyRidersWfResult.output?.possibleRiders.forEach((re: any) => {
      expect(re).toHaveProperty("distance");
      expect(re).toHaveProperty("rider");
    });
  });
});
```

The workflow:

```typescript
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
```

So first we simulate pulling the riders from our microservice, then we prepare the data so that it contains our simulated "last reported rider location" and then using our mapper we calculate the distance of each rider to the package. Finally we sort the riders by most near to the package. This will give us a list of riders with their distance to the package, sorted by distance to the package.

## Picking a Rider.

Given we have all the data we need, package origin, package destination, the riders and their destination to the package. We will pre-select `N` riders send them a notification of a possible ride, and simulate that a rider picks the ride. For this last part we are going to create a worker that given the preselected list of riders will just pick one randomly.

```typescript
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
```

In order to select our candidates. we are running a DO_WHILE task. which will notify our riders. (By posting to our dummyjson) Simulating we are letting our ridder know that there is a ride he will be interested in. We notify them in order from most near to the package to less near. and finally we simulate with a simple task that a rider has accepted our ride.

First we need to register the task. By registering the task we are letting conductor know that there is some worker that will be doing work for a task with the given name. Then we can add the simple task to our workflow.
We still need to create our actual worker that will do the work. Else when running the above workflow. The Workflow will SCHEDULE the task and wait for the SIMPLE task to finish. and this task will never get picked up by a worker.

## The Worker.

So to implement the worker we just need to create an object of type RunnerArgs. The actual worker takes a taskDefName the identifier for this worker and this will match with the task name of our SIMPLE task. You can have multiple workers "waitting for work" for the same task. The first one to poll for work for that task name will actually get the job done.

```typescript
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
```


### The Workflow

```typescript
// Having the nearby riders. we want to filter out those riders who are willing to get the ride.
// for this will simulate a POST where we ask the rider if he is willing to get the ride
describe("PickRider", () => {
  test("Creates a workflow", async () => {
    const client = await clientPromise;

    await expect(
      client.metadataResource.create(pickRider, true)
    ).resolves.not.toThrowError();
  });
  test("Every iteration should have the current driver", async () => {
    const client = await clientPromise;
    await createRiderRaceDefintion(client);

    const runner = riderRespondWorkerRunner(client);
    runner.startPolling();

    // Our N of pre-selected riders
    const maxCompetingRiders = 5;
    const targetRiders = [
      {
        distance: 12441.284548668005,
        rider: {
          id: 15,
          email: "kminchelle@qq.com",
        },
      },
      {
        distance: 16211.662539905119,
        rider: {
          id: 8,
          email: "ggude7@chron.com",
        },
      },
      {
        distance: 17435.548525470404,
        rider: {
          id: 29,
          email: "jissetts@hostgator.com",
        },
      },
      {
        distance: 17602.325904122146,
        rider: {
          id: 20,
          email: "aeatockj@psu.edu",
        },
      },
      {
        distance: 17823.508069312982,
        rider: {
          id: 3,
          email: "rshawe2@51.la",
        },
      },
      {
        distance: 17824.39318092907,
        rider: {
          id: 7,
          email: "dpettegre6@columbia.edu",
        },
      },
      {
        distance: 23472.94011516013,
        rider: {
          id: 26,
          email: "lgronaverp@cornell.edu",
        },
      },
    ];

    const workflowExecutor = new WorkflowExecutor(client);

    const executionId = await workflowExecutor.startWorkflow({
      name: pickRider.name,
      input: {
        maxCompetingRiders,
        targetRiders,
      },
      version: 1,
    });

    await new Promise((r) => setTimeout(() => r(true), 2500));
    const workflowStatus = await client.workflowResource.getExecutionStatus(
      executionId,
      true
    );

    expect(workflowStatus.status).toEqual("COMPLETED");

    // We check our task selected the amount of riders we are after.
    const doWhileTaskResult = workflowStatus?.tasks?.find(
      ({ taskType }) => taskType === TaskType.DO_WHILE
    );
    expect(doWhileTaskResult?.outputData?.iteration).toBe(maxCompetingRiders);
    expect(workflowStatus?.output?.selectedRider).toBeTruthy();

    runner.stopPolling();
  });
});
```

## Putting the pieces together.

So now that we have all our "ingredients" let put our fake Delivery app together. So basically what we want is. Given a client with a package request, that has an origin and a destination. we want to pick the best rider who is willing to take the package, to destination. As a bonus lets just compute the cost of the delivery, and make it less expensive if our client is paying by card as opposed to cash.

So first we will hit our nearByRiders passing the origin as an inputParameter. That will give us our possible riders, which we will pick one according to the distance to the package and "who answers first". Finally we will calculate the distance from origin to destination, to compute the cost.

The output will be our selected rider, and the cost of the shipping.

### The workflow

```typescript
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
        version: calculateDistanceWF.version,
        name: calculateDistanceWF.name,
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
```