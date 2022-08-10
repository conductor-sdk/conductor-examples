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

run `npm test`. So we just created our first workflow. which basically prints the output of its task. if you look at the generated json. you'll notice that there are some attributes we did not put that are being printed. Thats because the `generate` function will generate default/fake values that we will be overriding. you'll also notice that on the output i used  "${calculate_distance_ref.output.distance}" using the generated taskReferenceName. if you don't specify a taskReferenceName it will generate one by just adding `_ref` to the specified name. To reference a task output or a given task we always use the `taskReferenceName`. Another thing to notice is the true passes as the first argument. This flag specifies that the workflow will be overriden. Which is what we want since we will be running our tests over and over again.

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