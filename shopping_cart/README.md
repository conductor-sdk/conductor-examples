# Shopping Cart

## Description

In this example, a shopping cart is created for a user.  It can be updated multiple times during a session, and then a checkout can be made.

>Note: Checkout is a placeholder task at this time

Once the checkout experience has completed, a callback occurs if the checkout was successful.

If successful - the cart is emptied and the workflow ends.

If the checkout failed, the cart is placed back in shopping mode, and the user can try to checkout again.

## Detailed description

![workflow diagram](https://raw.githubusercontent.com/conductor-sdk/conductor-examples/main/shopping_cart/images/shopping_cart_workflow.jpg)


### Workflow Creation

On workflow startup, there are 2 variables created:

* `cart`: status is `shopping`. (The other possible setting is `checkout`.)
* `cart_items`:  A JSON array of items in the cart. each key:value pair is an item:quantity. For example, a cart with 2 hats, 1 pair of jeans and a laptop would look like:

```json
{
    "hat":2,
    "jeans":1,
    "MacBook Air":1
}
```

### Loop

Once created, the workflow enters a DO/WHILE loop.  This loop remains in effect until the `cart` variable changes to `checkout`.  Since we are in `shopping` mode, the loop remains in effect.

Tasks in the loop:

* `last_cart`: Creates a new variable called `old_cart` and places the current cart values in it (this is in anticipation of cart changes - allowing us to calculate changes in the cart, if desired).
* `cart_wait`: This is a wait task. The workflow pauses here for updates from the frontend website.  If there are changes to the cart, they will be sent to the endpoint

https://play.orkes.io/api/tasks/{workflowId}/cart_wait_ref__{counter}/COMPLETED

let's say the new payload is:

```json
{"cart":"shopping",
"cart_items":
{
  "sunglasses": 3,
  "shirt": 1,
  "hat": 4
}}
```

This will complete the `cart_wait` task.

* `cart_update`: The next task is a SET_VARIABLE task that updates the 2 variables based on the input from the previous WAIT task.

* `shopping_checkout` SWITCH task.  This task takes the `cart` variable.  If the status is `checkout`, the checkout case is taken. Otherwise, the status remains `shopping`, and the loop restarts.

### Checkout Branch

If the `cart` status from the update is changed to `checkout`, it is time to kick in the SUBWORKFLOW for checkout.  In this demo, no checkout takes place, but we will soon have workflows that can be replaced here to run a checkout.

* `checkout_task`: This SUBWORKFLOW runs the checkout. In this sample, it is a placeholder app that calculates pi to 2 digits. A sample checkout workflow is coming soon.

* `checkout_wait`: this task is a callback - if the checkout is successful or not.

* `checkout_switch`: 

 * If the payment is successful - follow the default route. This will empty the cart, exit the DO/WHILE and end the workflow.  
 * If the payment fails, we change `cart` back to `shopping` and the loop resets itself.  the user can add more items to the cart, or attempt to checkout again.