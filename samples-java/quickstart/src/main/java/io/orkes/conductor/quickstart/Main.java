package io.orkes.conductor.client;

import com.netflix.conductor.client.automator.TaskRunnerConfigurer;
import com.netflix.conductor.client.exception.ConductorClientException;
import com.netflix.conductor.client.http.TaskClient;
import com.netflix.conductor.client.http.WorkflowClient;
import com.netflix.conductor.client.worker.Worker;
import com.netflix.conductor.common.metadata.tasks.TaskDef;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.core.env.Environment;
import org.springframework.core.io.FileSystemResource;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
@SpringBootApplication(exclude = { DataSourceAutoConfiguration.class, ValidationAutoConfiguration.class })
@ComponentScan(basePackages = { "io.orkes" })
public class Main {

    private static final String CONDUCTOR_SERVER_URL = "conductor.server.url";
    private static final String CONDUCTOR_CLIENT_KEY_ID = "conductor.security.client.key-id";
    private static final String CONDUCTOR_CLIENT_SECRET = "conductor.security.client.secret";

    private final Environment env;
    private final List<RemoteWorker> workersList;
    private ScheduledExecutorService delayedTaskRegistrationService;

    public OrkesConductorWorkersApplication(Environment env, List<RemoteWorker> workersList) {
        this.env = env;
        this.workersList = workersList;
        this.delayedTaskRegistrationService = Executors.newScheduledThreadPool(1);
        this.delayedTaskRegistrationService.scheduleAtFixedRate(() -> {
            try {
                log.info("Trying to register task definitions for workers");
                wireupTaskDefinitions();
                log.info("Done registering task definitions for workers, going to shutdown timer");
                delayedTaskRegistrationService.shutdown();

            } catch (Exception e) {
                //log.error(e.getMessage(), e);
                log.error("Error registring the tasks with server: {}", e.getMessage());
            }
        }, 1, 1, TimeUnit.MINUTES);
    }

    public static void main(String[] args) throws IOException {
        log.info("Starting conductor enterprise workers ... v1");
        loadExternalConfig();
        SpringApplication.run(OrkesConductorWorkersApplication.class, args);
    }

    public void wireupTaskDefinitions() {
        String rootUri = env.getProperty(CONDUCTOR_SERVER_URL);
        log.info("Conductor Server URL: {}", rootUri);

        OrkesMetadataClient metadataClient = new OrkesMetadataClient();
        metadataClient.setRootURI(rootUri);
        setCredentialsIfPresent(metadataClient);

        log.info("Registering tasks if required for workers : {}", workersList);
        workersList.forEach(worker -> {
            TaskDef taskDef = null;
            try {
                taskDef = metadataClient.getTaskDef(worker.getTaskDefName());
            } catch (ConductorClientException e) {
                log.warn("Error loading definition: " + e.getMessage(), e);
            }
            if (taskDef == null) {
                log.info("Registering task definition for {}", worker.getTaskDefName());
                metadataClient.registerTaskDefs(Collections.singletonList(worker.getTaskDef()));
            }
        });
        registerWaitForEventTaskDefinition(metadataClient);
    }

    private void registerWaitForEventTaskDefinition(OrkesMetadataClient metadataClient) {
        TaskDef taskDef = null;
        try {
            taskDef = metadataClient.getTaskDef("WAIT_FOR_EVENT");
        } catch (ConductorClientException e) {
            log.warn("Error loading definition: " + e.getMessage(), e);
        }
        if (taskDef == null) {
            taskDef = new TaskDef();
            taskDef.setName("WAIT_FOR_EVENT");
            taskDef.setDescription("Task that awaits for an event to complete");
            taskDef.setTimeoutSeconds(3600);
            taskDef.setTimeoutPolicy(TaskDef.TimeoutPolicy.TIME_OUT_WF);
            log.info("Registering task definition for {}", "WAIT_FOR_EVENT");
            metadataClient.registerTaskDefs(Collections.singletonList(taskDef));
        }
    }

    @Bean
    public TaskRunnerConfigurer taskRunnerConfigurer(List<Worker> workersList) {
        String rootUri = env.getProperty(CONDUCTOR_SERVER_URL);
        log.info("Conductor Server URL: {}", rootUri);
        OrkesTaskClient taskClient = new OrkesTaskClient();
        taskClient.setRootURI(rootUri);
        setCredentialsIfPresent(taskClient);

        Boolean testWorkersEnabled = env.getProperty("conductor.worker.load_test.enabled", Boolean.class);
        if (testWorkersEnabled == null) {
            testWorkersEnabled = false;
        }

        Map<String, Integer> taskThreadCount = new HashMap<>();
        for (Worker worker : workersList) {
            taskThreadCount.put(worker.getTaskDefName(), 10);
        }

        if (testWorkersEnabled) {
            for (int i = 0; i < 10; i++) {
                workersList.add(new LoadTestWorker("test_worker_" + i));
                taskThreadCount.put("test_worker_" + i, 20);
            }
        }

        log.info("Starting workers : {}", workersList);
        TaskRunnerConfigurer runnerConfigurer = new TaskRunnerConfigurer.Builder(taskClient, workersList)
                .withTaskThreadCount(taskThreadCount)
                .build();
        runnerConfigurer.init();
        return runnerConfigurer;
    }

    @Bean
    public WorkflowClient getWorkflowClient() {
        String rootUri = env.getProperty(CONDUCTOR_SERVER_URL);
        OrkesWorkflowClient workflowClient = new OrkesWorkflowClient();
        workflowClient.setRootURI(rootUri);
        setCredentialsIfPresent(workflowClient);

        return workflowClient;
    }

    @Bean
    public TaskClient getTaskClient() {
        String rootUri = env.getProperty(CONDUCTOR_SERVER_URL);
        OrkesTaskClient taskClient = new OrkesTaskClient();
        taskClient.setRootURI(rootUri);
        setCredentialsIfPresent(taskClient);

        return taskClient;

    }

    private void setCredentialsIfPresent(OrkesClient client) {
        String keyId = env.getProperty(CONDUCTOR_CLIENT_KEY_ID);
        String secret = env.getProperty(CONDUCTOR_CLIENT_SECRET);
        if (!StringUtils.isBlank(keyId) && !StringUtils.isBlank(secret)) {
            log.info("setCredentialsIfPresent: Using authentication with access key '{}'", keyId);
            client.withCredentials(keyId, secret);
        } else {
            log.info("setCredentialsIfPresent: Proceeding without client authentication");
        }
    }

    private static void loadExternalConfig() throws IOException {
        String configFile = System.getProperty("CONDUCTOR_CONFIG_FILE");
        if (configFile == null) {
            configFile = System.getenv("CONDUCTOR_CONFIG_FILE");
        }
        if (!StringUtils.isEmpty(configFile)) {
            FileSystemResource resource = new FileSystemResource(configFile);
            if (resource.exists()) {
                System.getenv().forEach((k, v) -> {
                    log.info("System Env Props - Key: {}, Value: {}", k, v);
                    if (k.startsWith("conductor")) {
                        log.info("Setting env property to system property: {}", k);
                        System.setProperty(k, v);
                    }
                });
                Properties existingProperties = System.getProperties();
                existingProperties.forEach((k, v) -> log.info("Env Props - Key: {}, Value: {}", k, v));
                Properties properties = new Properties();
                properties.load(resource.getInputStream());
                properties.forEach((key, value) -> {
                    String keyString = (String) key;
                    if (existingProperties.getProperty(keyString) != null) {
                        log.info("Property : {} already exists with value: {}", keyString, value);
                    } else {
                        System.setProperty(keyString, (String) value);
                    }
                });
                log.info("Loaded {} properties from {}", properties.size(), configFile);
            } else {
                log.warn("Ignoring {} since it does not exist", configFile);
            }
        }
    }
}
