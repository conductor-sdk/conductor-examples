# BUILDING A DELIVERY WORKFLOW WITH TS

So let imagine we want to build a delivery workflow. For the purpose of this exercise we will imagine that we get a request from our fakeDeliveryApp user that wants to send a package from an origin to a package destination. We as an app that has both register clients and registers riders (people willing to take our package for a fee) will be in charge to connect the best fitting rider to do the job.
For this we will pull our registered riders. pick the best candidates (the ones most near to our package) and let them compete to win the ride.

## What we need

- Registered Riders.
- A way to let our riders know they have a possible delivery
- a way for our riders to "compete" or be the first one to select the ride.

### "Materials"

To simulate some api calls we will use `http://dummyjson.com` dummy json provides us with fake apis. We will use the user api to simulate the pulling of our registered riders. And the posts api to simulate the notifying the rider that he has a ride nearby.

Since we are going to create this workflow as code. Instead of using the diagram. lets try to start with the Test and build our workflow app from the ground up.
To avoid downloading and setting conductor we will be using Orkes Play. a free conductor playground `https://play.orkes.io/`. But the same applies for netflix conductor.

So after logging or sign-up. We need to create an application under the Application menu. Then edit. then just toggle all permissions to on and copy both appKey and secret from the window.

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
  calculateDistanceWF,
} from "./mydelivery";

describe("My Delivery Test", () => {
  const clientPromise = orkesConductorClient(playConfig);
  describe("Calculate distance workflow", () => {
    test("Creates a workflow", async () => {
      const client = await clientPromise;
      const workflowExecutor = new WorkflowExecutor(client);
      await expect(
        workflowExecutor.registerWorkflow(true, calculateDistanceWF)
      ).resolves.not.toThrowError();
      console.log(JSON.stringify(calculateDistanceWF,null,2))
    });
  });
```

run `npm test`. So we just created our first workflow. which basically prints the output of its task. if you look at the generated json. you'll notice that there are some attributes we did not put that are being printed. Thats because the `generate` function will generate default/fake values that we will be overriding. you'll also notice that on the output i used  "${calculate_distance_ref.output.distance}" using the generated taskReferenceName. if you don't specify a taskReferenceName it will generate one by just adding `_ref` to the name. To reference a task output or a given task we always use the `taskReferenceName`.