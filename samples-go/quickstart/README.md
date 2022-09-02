# Quickstart Example
This in example, we demonstrate how to create a simple two-step workflow 
and write a simple test that validates the workflow defintion and its execution


### Running Example

> **Note**
Obtain KEY and SECRET from the playground or your Conductor server

Export variables
```shell
export KEY=
export SECRET=
export CONDUCTOR_SERVER_URL=https://play.orkes.io/api
```

Run the main program
```shell
go run main.go

```

Run the test
```shell
go test

```

Run only the workers
```shell
go run worker/main.go
```
