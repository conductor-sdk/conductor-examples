The US POst Office has a number of APIs to simplify shipping.

These workflows further abstract the APIs - taking account of many important features. The USPS requests and responses are all XML, and these workflows manage the conversions so that the inputs and outputs are JSON.

1. **check_address**.  The USPS can verify 160M addresses.  This workflow wither either respond with the USPS version of the address (often in all CAPS), or with an error that the address was not found.

Sample input:

 ```json
{
  "street": "100 Winchester Circle",
  "city": "Los Gatos",
  "state": "CA"
}
 ```


2. **postage_rate**  given a toZip and  fromZip, and some dimensions of the box (and the shipping type), this workflow will output the price for that shipping type.

sample input:
```json
{
  "service": "priority",
  "zipFrom": "04046",
  "zipTo": "98260",
  "pounds": 20,
  "ounces": 0,
  "container": "variable",
  "width": 12,
  "height": 12,
  "length": 12
}
```