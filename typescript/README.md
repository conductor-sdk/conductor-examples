# BUILDING A DELIVERY WORKFLOW WITH TS

So let imagine we want to build a delivery workflow. For the purpose of this exercise we will imagine that we get a request from our fakeDeliveryApp user that wants to send a package from an origin to a package destination. We as an app that has both register clients and registers riders (people willing to take our package for a fee) will be in charge to connect the best fitting rider to do the job.
For this we will pull our registered riders. pick the best candidates (the ones most near to our package) and let them compete to win the ride.

## What we need

- Registered Riders.
- A way to let our riders know they have a possible delivery
- a way for our riders to "compete" or be the first one to select the ride.

### "Materials"

To simulate some api calls we will use `http://dummyjson.com` dummy json provides us with fake apis. We will use the user api to simulate the pulling of our registered riders. And the posts api to simulate the notifying the rider that he has a ride nearby.

Since we are going to create this workflow as code. Instead of using the diagram. lets try to start with the Test and build our workflow app from the ground up. For the excercise I will be using Orkes Play. a free conductor playground `https://play.orkes.io/`. But the same applies for netflix conductor, only you wont need to specify the credentials.

In my case i will create an application under the Application menu. Then edit. then just toggle all permissions to on and copy both appKey and secret from the window.

## Workflow as code

## Project setup

Create an npm project with `npm init` answer the questions and then install the sdk with `npm i @io-orkes/conductor-typescript`.
TODO add jest configuration

## Getting started

Since we will be creating the workflow as code let's create two files mydelivery.ts and mydelivery.test.ts. By writing our code along with the test, we will get instant feedback and know exactly what's going on, on every save.

### Creating our workflow

So for our workflow to work. we will need to calculate the distance between two points. Because we are going to calculate the distance between the riders two the package origin. and we also want to know the distance between origin to destination. In order to calculate the price. So lets create a workflow that just does that. that way we have a really simple workflow we can just test.

But first... lets just create a workflow that outputs the result of some function. So in our mydelivery.ts lets do the following:

```typescript
import {
  generate,
  TaskType,
  OrkesApiConfig,
} from "@io-orkes/conductor-typescript";

export const playConfig: Partial<OrkesApiConfig> = {
  keyId: "KEY_ID_FROM_PLAY",
  keySecret: "KEY_SECRET_FROM_PLAY",
  serverUrl: "https://play.orkes.io",
};

export const calculateDistanceWF = generate({
  name: "calculate_distance",
  inputParameters: ["origin", "destination"],
  tasks: [
    {
      type: TaskType.INLINE,
      name: "calculate_distance",
      inputParameters: {
        expression: "{distance: 12}",
      },
    },
  ],
  outputParameter: {
    distance: "${calculate_distance_ref.output.distance}",
  },
});
```

Now in our test file lets create a test that just creates the workflow. So that we can later look at it on Play.

```typescript

import {
  generate,
  orkesConductorClient,
  ConductorClient,
} from "@io-orkes/conductor-typescript";
import {
  calculateDistanceWF,
} from "./mydelivery";

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
      console.log(JSON.stringify(calculateDistanceWF,null,2))
    });
  });
```

run `npm test`. So we just created our first workflow. which basically prints the output of its task. if you look at the generated json. you'll notice that there are some attributes we did not put that are being printed. Thats because the `generate` function will generate default/fake values that we will be overriding. you'll also notice that on the output i used "${calculate_distance_ref.output.distance}" using the generated taskReferenceName. if you don't specify a taskReferenceName it will generate one by just adding `_ref` to the specified name. To reference a task output or a given task we always use the `taskReferenceName`. Another thing to notice is the true passes as the first argument. This flag specifies that the workflow will be overriden. Which is what we want since we will be running our tests over and over again.

We will now run our workflow for this we will add the following test.

```typescript
    test("Should calculate distance", async () => {
      // Just picked two random points.
      const origin = {
        latitude: -34.4810097,
        longitude: -58.4972602,
      };

      const destination = {
        latitude: -34.494858,
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
      const workflowStatus = await workflowExecutor.getWorkflow(
        executionId,
        true
      );

      expect(workflowStatus?.status).toEqual("COMPLETED");
      // for now we expect the output of our workflow to be our hardcoded value.
      expect(workflowStatus?.output?.distance).toBe(12);
    });
  });
```

Run `yarn test`. Great we have our first workflow execution run!.

## Calculating the real distance.

So what we want is something that calculates the real distance. or an aprox distance between the two points. To get the distance between two points in a sphere we can use Havesine(http://www.movable-type.co.uk/scripts/latlong.html) but since we dont want a direct distance because our riders cant fly :P we are going to implement something like https://en.wikipedia.org/wiki/Taxicab_geometry

## The INLINE TASKS

For tasks that require really simple code. An inline task can take inputParameters where we will map our context. and an expression where we can make use of this context in javascript.
If we go back to our `calculate_distance` workflow takes no context. and returns a hardcoded object. Lets modify our inline task to take the origin and destination into its context. and calculate the aprox distance.

```typescript
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

            return {
              distance:
                Math.abs(latitudeDistance) + Math.abs(longitudeDistance),
            };
          };
        },
      },
    }
```

If we run the tests. the tests are going to fail because it is not 12. But Red-Green-Refactor If we pick two cardinal points we do know the manhatam distance. we should make it pass [TODO add actual example and some online calculator]. [TODO try to extract function to test function].

**Note** The following from above. I was able to type ES5 javascript on my editor. however you cant use closures and the returned function. has to be written in ES5. Else our tests will fail.

If we run our tests now a workflow is registered. overriding the old one. Then we are running the workflow and we get a result.

## Finding the best Rider.

Now that we have a workflow. which we can think of as an function we can latter import into another project. Lets create our workflow number two. This workflow will simulate hitting a micoservice that pulls are regitered drivers. We will latter pick from our riders list the bes suited riders for the job.

### Hitting our fake microservice.

To hit something simple as an HTTP microservice we can use the HTTP Task. The Http Task will take some inputParameters and hit an endpoint with our configuration. It is similar to Curl or POSTMAN. We will be using `http://dummyjson.com/users` which returns a list of users with a address. We will think of this address as the last reported address from our rider.

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

Our findNearByRiders takes an endpoint and its method and returns all available riders. Lets write the test.

```typescript
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
```

If we run our test. The test should pass since the amount of users. is like 30. And if we look at the printed output. we can see the whole structure being returned by the endpoint.

Our workflow is not yet complete since we are only interested in the distance from the riders to the package. and this workflow is returning every possible rider. To get the distance from the package for every rider. we would like to run our previous workflow. for every rider we have on the list. Lets do this by first preparing our data. so that it can be passed to the next workflow. To do this we can use the JQ Task. Which let us run JSON querys over a json data.

## JQ Task.

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
From the above task definition you can see im mapping into my JQ `users` context variable the output of the HTTP task and then extracting the address. The expected result should have the structure {identity:{id,email}, to:{latitude,longitude}, from:{latitude,longitude}}. Leaving us with the expected parameters for the calculate_distance workflow.

##.Map
