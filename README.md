![eth-net-aut](https://i.imgur.com/wqJGMl9.jpg)
![npm](https://img.shields.io/npm/v/ethereum-network-automation)

Ethereum Network Automation is a comprehensive package designed for the setup and management of Ethereum networks, particularly focusing on the Clique consensus algorithm for Proof of Authority (PoA). Unlike tools that rely on virtualization of the Ethereum Virtual Machine (EVM), this package facilitates a more authentic environment for testing the interoperability between smart contracts across different EVM networks.

🚀  For a fast setup, head over to [**Quick Start**](#quick-start) section.

#### Introduction

The primary goal is to enable developers and blockchain enthusiasts to easily deploy and manage Ethereum networks. By leveraging both Geth for direct blockchain interactions and Docker for containerized environments, it offers a versatile toolkit for experimenting with Ethereum's PoA consensus.

---
## Security Notice

This package comes with predefined wallets intended solely for local development and testing purposes. These wallets are not secure for user or production use. While the package provides functionality to create new accounts and node accounts, it's essential to handle such operations with caution. Any use of these features is at the user's own risk.

---

## Prerequisites

Before you begin deploying networks with this package, it's crucial to have the necessary tools and environments set up. Here are the prerequisites based on your deployment method:

#### Local Deployments Using Geth
For deploying Ethereum networks locally using Geth, you'll need:
- **Geth**: Version 1.13.14-stable or later installed on your system. Geth is the Go Ethereum client and is essential for running nodes on the Ethereum network.

### Docker Deployments
For deploying networks within Docker containers, you'll need:
- **Docker**: Ensure Docker is installed and running on your system. This package uses the `ethereum/client-go:stable` Docker image for deployments, providing a standardized Ethereum client environment.

##### Windows Users
This package is optimized for Linux-based environments, including macOS and Linux distributions. Windows users can still utilize this package by setting up WSL (Windows Subsystem for Linux), which allows you to run a Linux environment directly on Windows, without the overhead of a traditional virtual machine. 

Further, due to potential complications arising from how ports are managed and assigned on WSL, **Windows users are strongly encouraged to utilize Docker through WSL** for deploying and managing Ethereum networks and nodes with this tool.

---
## Quick Start
Install the package using npm: 
`npm i ethereum-network-automation`

Examples of how to deploy networks using cli or built-in methods

#### CLI 
```
npx peth-poa --docker run --chain 12345
```
#### Methods 
```js
const { pethPoa } = require('ethereum-network-automation')

async function startDockerNetwork(chainId) {
    await pethPoa.docker.initAndDeployNetwork(chainId);
}

async function startLocalNetwork(chainId) {
    await pethPoa.geth.initAndStartNetwork(chainId);
}

// Deploy a local network
startLocalNetwork(54321);

// Deploy a network using Docker
startDockerNetwork(666777);
```

--- 
### **Predefined Node Addresses**

The package comes equipped with predefined addresses for initializing networks quickly. These addresses are as follows:

- **Bootstrap Node Address**: **`"0xCeB5ca48b5DE1839379FAEDD0572F7D59B279749"`**
- **Signer Node Address**: **`"0x64fB496Bbfd447Dba254aFe4E28a325cb19ec25f"`**
- **RPC Node Address**: **`"0x46198b00f237407133da9CcFb2D567dF159284D4"`**
- **Member Node Address**: **`"0xBa551f402cfC912482cB15466641E6FC3B2D63f2"`**

Additionally, the package currently includes three addresses for each node type:

- **Bootstrap**:
    - **`"0xCeB5ca48b5DE1839379FAEDD0572F7D59B279749"`**
    - **`"0x3DACb6190a02bB8762b769fA3805A53ced2daecD"`**
    - **`"0xeA9c0401958De72D6ccED22dA3134e296282fc1b"`**
- **Signer**:
    - **`"0x64fB496Bbfd447Dba254aFe4E28a325cb19ec25f"`**
    - **`"0x6D327167519f708706CaA82c22A51f9170E3dE0F"`**
    - **`"0x593137Db85160Ae8E9047f539141DD04d5251381"`**
- **RPC**:
    - **`"0x46198b00f237407133da9CcFb2D567dF159284D4"`**
    - **`"0xec326126b342dbEa16FFe17c401bE6560B524d69"`**
    - **`"0xEEA50912a99B1F8D4E94565f9e44c30A1a961caa"`**
- **Member**:
    - **`"0xBa551f402cfC912482cB15466641E6FC3B2D63f2"`**
    - **`"0x8D9711f5793A1122dB151568FA67DacCC16B2326"`**
    - **`"0x46B7954f9FA8992bE5B27c3de46A87F83314Bb25"`**

Please note, these accounts are included for development and testing purposes only and should not be used for production or with real assets due to security considerations. It is recommended to create new accounts and nodes for personal or production use.

---
## CLI Commands

This CLI tool is designed to simplify interaction with your local Ethereum testnet, leveraging Docker for enhanced stability and a frictionless setup experience. Docker provides a consistent and isolated environment, ensuring that the CLI tool functions uniformly across different systems.

### Command Overview

The CLI supports a commands to manage the deployment for Docker networks. Make your you have already the package install for them to work.

#### Docker Network Commands

- **Deploy Network**: Initializes and deploys a Docker network for the specified blockchain chain ID.
  ```
  npx peth-poa --docker run --chain <chainId>
  ```
  - `--chain <chainId>`: Specifies the chain ID for the network to be deployed.

- **Remove Network**: Removes an existing Docker network associated with the specified chain ID.
  ```
  npx peth-poa --docker rm --chain <chainId>
  ```
  - `--chain <chainId>`: Specifies the chain ID for the network to be removed.

#### Docker Node Commands

- **Add Node**: Deploys a Docker container as a blockchain node. For new networks, ensure you have first deployed the bootstrap node for others to pair and connect.
  ```
  npx peth-poa --docker-node run --chain <chainId> --type <nodeType> --address <address>
  ```
  - `--chain <chainId>`: Specifies the chain ID for the network.
  - `--type <nodeType>`: Defines the type of the node (`bootstrap`, `signer`, `rpc`, or `member`).
  - `--address <address>`: Provides the address to be associated with the node.

- **Remove Node**: Removes an existing Docker node container.
  ```
  npx peth-poa --docker-node rm --chain <chainId> --address <address>
  ```
  - `--chain <chainId>`: Specifies the chain ID associated with the node.
  - `--address <address>`: The address (or container name/ID) of the node to be removed.

#### Query Node Addresses

- **Get Node Addresses**: Displays the addresses of nodes predefined in this package, categorized by their type.
  ```
  npx peth-poa nodes get
  ```
---

## Functionalities and Methods

### Account Management
- **createAccount(accountName: string, password: string):** Creates a new account with a given name and password.

### Genesis Creation
- **createGenesis(chainId: number, signers: string[], alloc: Record<string, { balance: string }>, period?: number, epoch?: number):** Generates a genesis file for a specified chain ID with signer addresses, pre-allocated balances, and optionally, block period and epoch length for PoA networks.

### Network Configuration
- **getConfig(chainId: number):** Retrieves the current configuration for a given chain ID.
- **getRpc(chainId: number):** Fetches the RPC URL for the specified chain ID.

### Node Management
- **createNode(nodeType: 'bootstrap' | 'signer' | 'rpc' | 'member', password: string):** Creates a node of the specified type with a password for its account.
- **initNode(chainId: number, nodeType: 'bootstrap' | 'signer' | 'rpc' | 'member', nodeAddress: string):** Initializes a node with the given type and address for the specified chain ID.
- **startNode(chainId: number, nodeType: 'bootstrap' | 'signer' | 'rpc' | 'member', nodeAddress: string):** Starts a node with the specified details, optionally including an external IP and subnet.
- **initAndStartNode(chainId: number, nodeType: 'bootstrap' | 'signer' | 'rpc' | 'member', nodeAddress: string, externalIp?: string, subnet?: string):** Combines initialization and starting of a node with given parameters.

### Geth Deployment
- **initAndStartNetwork(chainId: number):** Initializes and starts a local network for the specified chain ID using Geth.

### Docker Deployment
- **initAndDeployNode(chainId: number, nodeType: 'bootstrap' | 'signer' | 'rpc' | 'member', nodeAddress: string):** Initializes and deploys a Docker node of the specified type for a given chain ID.
- **initAndDeployNetwork(chainId: number):** Initializes and deploys a Docker network for the specified chain ID.
- **removeNodeContainer(chainId: number, nodeAddress: string):** Removes a Docker container for a node specified by chain ID and node address.
- **removeNetwork(chainId: number):** Removes all containers associated with the specified Docker network.

### Examples:

#### Account Management
```javascript
await pethPoa.accounts.createAccount('myAccount', 'myStrongPassword');
```

#### Genesis Creation
```javascript
await pethPoa.genesis.createGenesis(123, ['0x...'], {'0x...': {balance: '1000000'}}, 5, 30000);
```

#### Network Configuration
```javascript
const config = await pethPoa.network.getConfig(123);
console.log(config);

const rpcUrl = await pethPoa.network.getRpc(123);
console.log(rpcUrl);
```

#### Geth and Docker Deployment
```javascript
// Initialize and start a Geth network
await pethPoa.geth.initAndStartNetwork(123);

// Deploy a Docker node
await pethPoa.docker.initAndDeployNode(123, 'bootstrap', '0x1234123123');

// Remove a Docker network
await pethPoa.docker.removeNetwork(123);
```

## Future Plans

Short-term goals for `ethereum-network-automation` include:

- **Kubernetes Support**: Expansion into Kubernetes for network deployment to facilitate scalable and distributed network management.
- **Consensus Exploration**: Support for other consensus algorithms beyond PoA, primarily PoS using lightnode.

---
## **Contributing**

We warmly welcome contributions, including feature enhancements, documentation improvements, and bug reports.
This README aims to serve as a guide. As the project evolves, the updates to this document will ensure it remains a valuable resource.