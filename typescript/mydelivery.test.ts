import { expect, describe, test, afterAll } from "@jest/globals";
import {
  calculateDistanceWorkflow,
  nearByRiders,
  workflowDotMap,
  pickRider,
  riderRespondWorkerRunner,
  createRiderRaceDefintion,
  deliveryWorkflow,
} from "./mydelivery";
import {
  OrkesApiConfig,
  orkesConductorClient,
  TaskType,
  WorkflowExecutor,
} from "@io-orkes/conductor-typescript";

// const testConfig: Partial<OrkesApiConfig> = {
//   keyId: "1f8f740c-9117-4016-9cb8-c1d43ed75bb4",
//   keySecret: "zR0kkWGx17HDNhH2zlfu2IrGtATlmnyQS6FrHlDZXriSsW7M",
//   BASE: "http://localhost:8080",
// };

const playConfig: Partial<OrkesApiConfig> = {
  keyId: "dd16ab51-666a-4574-969b-4cf87263b0fd",
  keySecret: "DAK0Nmr80TyG7PdJWRCoPRxzqVoaJgzPQAsQkCnwA1m2DYs8",
  BASE: "https://play.orkes.io",
};

describe("My Delivery Test", () => {
  const clientPromise = orkesConductorClient(playConfig);
  describe("Calculate distance workflow", () => {
    test("Creates a workflow", async () => {
      const client = await clientPromise;
      const workflowExecutor = new WorkflowExecutor(client);
      await expect(
        workflowExecutor.registerWorkflow(true, calculateDistanceWorkflow)
      ).resolves.not.toThrowError();
    });

    test("Gets existing workflow", async () => {
      const client = await clientPromise;
      const wf = await client.metadataResource.get(
        calculateDistanceWorkflow.name
      );
      expect(wf.name).toEqual(calculateDistanceWorkflow.name);
      expect(wf.version).toEqual(calculateDistanceWorkflow.version);
    });

    test("Calculates a similar distance", async () => {
      const from = {
        latitude: -34.4810097,
        longitude: -58.4972602,
      };
      const to = {
        latitude: -34.494858,
        longitude: -58.491168,
      };
      const estimatedPackageSize = "not-ready";

      const client = await clientPromise;
      const workflowExecutor = new WorkflowExecutor(client);
      const executionId = await workflowExecutor.startWorkflow({
        name: calculateDistanceWorkflow.name,
        version: 1,
        input: {
          from,
          to,
          estimatedPackageSize,
        },
      });
      const workflowStatus = await workflowExecutor.getWorkflow(
        executionId,
        true
      );
      expect(workflowStatus?.output?.distance).toBeGreaterThan(2);
      expect(workflowStatus?.output?.distance).toBeLessThan(3);
    });
  });

  // Need a way to .map like we do in javascript. Using current Conductor constructs we can do this by doing a workflow.
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
            identity: "js@js.com",
          }),
        ])
      );
    });
  });

  /**
   * Cool now that we have a decopled way to find the distance between two coordinates.
   * Lets make a wokflow that pulls our users with the report of their latest address.
   * Later on we want to check the distance between the riders and the pickup address for the package.
   */

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
      const doWhileTaskResult = workflowStatus?.tasks?.find(
        ({ taskType }) => taskType === TaskType.DO_WHILE
      );
      expect(doWhileTaskResult?.outputData?.iteration).toBe(maxCompetingRiders);
      expect(workflowStatus?.output?.selectedRider).toBeTruthy();

      runner.stopPolling();
    });
  });

  describe("deliveryWorkflow", () => {
    test("Creates a workflow", async () => {
      const client = await clientPromise;

      await expect(
        client.metadataResource.create(deliveryWorkflow, true)
      ).resolves.not.toThrowError();
    });
    test("Should run the workflow", async () => {
      const client = await clientPromise;

      const runner = riderRespondWorkerRunner(client);
      runner.startPolling();

      const workflowExecutor = new WorkflowExecutor(client);

      const executionId = await workflowExecutor.startWorkflow({
        name: deliveryWorkflow.name,
        input: {
          packageDestination: {
            latitude: 38.867033,
            longitude: -76.979235,
          },
          origin: {
            latitude: 38.867043,
            longitude: -76.979245,
          },
          paymentMethod: "card",
        },
        version: 1,
      });

      await new Promise((r) => setTimeout(() => r(true), 3800));

      const workflowStatus = await client.workflowResource.getExecutionStatus(
        executionId,
        true
      );
      expect(workflowStatus.status).toBe("COMPLETED");
      expect(workflowStatus?.output?.rider).toBeTruthy();
      expect(typeof workflowStatus?.output?.totalPrice).toBe("number");

      runner.stopPolling();
    });
  });

  afterAll(async () => {
    // const client = await orkesConductorClient(playConfig);
    // await client.metadataResource.unregisterWorkflowDef(
    //   calculateDistanceWorkflow.name,
    //   calculateDistanceWorkflow.version
    // );
    // await client.metadataResource.unregisterWorkflowDef(
    //   nearByRiders.name,
    //   nearByRiders.version
    // );
    // await client.metadataResource.unregisterWorkflowDef(
    //   workflowDotMap.name,
    //   workflowDotMap.version
    // );
    // await client.metadataResource.unregisterWorkflowDef(
    //   pickRider.name,
    //   pickRider.version
    // );
  });
});
