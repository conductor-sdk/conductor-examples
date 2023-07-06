# StandUp Bot Using Conductor-Slack Integration

Sample Application to create a standup bot for posting daily updates on a Slack channel using Orkes Conductor.

## Workflow Overview

- The workflow is kicked off at a specific time (e.g., 10 AM) on weekdays.
- The workflow sends a personalized message to each team member to provide an update.
- Users provide an update to the bot.
- The workflow waits for all the updates to arrive and waits for a specific time (e.g., 3 hours).
- Once all the updates are given or the timeout occurs, all the updates are collected and posted to a shared team channel.

We can define this workflow visually as follows:

![Workflow Diagram](./standup-bot.jpg)

Click [here](https://play.orkes.io/workflowDef/standup_updates_main/1) to access this definition on Conductor playground.

In this example, we have 2 users. They are the forks of a fork-join task. These forks run in parallel to complete the workflow. For each individual, a fork is to be added, where each fork includes a sub-workflow, which is nothing but incorporating another workflow within your main workflow. 

Here’s how the workflow for individual updates looks like:

![Workflow Diagram](./individual-updates-workflow.jpg)

Click [here](https://play.orkes.io/workflowDef/individual_updates) to access this definition on Conductor Playground.

When the main workflow is run, all the forks execute in parallel. So let’s see how each of the individual updates is processed.

- The workflow begins with an HTTP task (**send_welcome_message**) that sends a welcome message to the user asking for daily updates.
- It is followed by a do-while task (**loopTask**) that captures the user inputs. The loop condition is checked based on the webhook task (**webhook_task)**, which captures incoming events from Slack. 
- A series of JSON JQ Transform tasks then follow it.
    - **jq_aggregate_updates** - Used to aggregate updates from the user.
    - **jq_convert_to_string** - Used to convert the updates into CSV format.
    - **append_user_name** - Used to append the user name with updates.
- The final output is posted to the Slack channel using an HTTP task (post_updates). 