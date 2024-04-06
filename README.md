# Ethereum Network Automation

Ethereum Network Automation (`ethereum-network-automation`) is a comprehensive package designed for the setup and management of Ethereum networks, particularly focusing on the Clique consensus algorithm for Proof of Authority (PoA). Unlike tools that rely on virtualization of the Ethereum Virtual Machine (EVM), such as @ethereumjs/vm (used by Hardhat and Remix), this package facilitates a more authentic environment for testing the interoperability between smart contracts across different EVM networks.

## Introduction

The primary goal of `ethereum-network-automation` is to enable developers and blockchain enthusiasts to easily deploy and manage Ethereum networks. By leveraging both Geth for direct blockchain interactions and Docker for containerized environments, it offers a versatile toolkit for experimenting with Ethereum's PoA consensus and beyond.

## Prerequisites

Before deploying networks using this package, ensure that you have the following prerequisites installed:

- **For local deployments using Geth**: Geth version 1.13.14-stable or later.
- **For Docker deployments**: Docker must be installed and running. The Docker deployments use the `ethereum/client-go:stable` image.

## Security Notice

This package comes with predefined wallets intended solely for local development and testing purposes. These wallets are not secure for user or production use. While the package provides functionality to create new accounts and node accounts, it's essential to handle such operations with caution. Any use of these features is at the user's own risk.

## Quick Start

Below we can see a simple example of how to deploy networks using Docker and Geth.

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
## Functionalities and Methods

`ethereum-network-automation` provides a variety of methods to manage Ethereum networks and nodes:

### Account Management

- `createAccount(accountName, password)`: Creates a new account with the specified name and password.

### Genesis Creation

- `createGenesis(chainId, signers, alloc)`: Generates a genesis file for the specified chain ID, including signer addresses and pre-allocated balances.

### Network Configuration

- `getConfig(chainId)`: Retrieves the current network configuration.

### Geth Deployment

- `initAndStartNode(chainId, nodeType, nodeAddress)`: Initializes and starts a Geth node of the specified type.
- `initAndStartNetwork(chainId)`: Initializes and starts a local network for the specified chain ID.

### Docker Deployment

- `initAndDeployNode(chainId, nodeType, nodeAddress)`: Initializes and deploys a Docker node of the specified type.
- `initAndDeployNetwork(chainId)`: Initializes and deploys a Docker network for the specified chain ID.
- `removeNodeContainer(chainId, nodeAddress)`: Removes a Docker container for a specified node.
- `removeNetwork(chainId)`: Removes all containers associated with a specified Docker network.

## Future Plans

Short-term goals for `ethereum-network-automation` include:

- **CLI Tool**: Introduction of a command-line interface (CLI) tool for executing network and node operations directly from the shell.
- **Kubernetes Support**: Expansion into Kubernetes for network deployment to facilitate scalable and distributed network management.
- **Consensus Exploration**: Exploration and support for other consensus algorithms beyond PoA.

Through these enhancements, `ethereum-network-automation` aims to become an even more powerful and accessible tool for Ethereum network development and management.

## **Contributing**

We warmly welcome contributions, including feature enhancements, documentation improvements, and bug reports.

This README aims to serve as a comprehensive guide to getting started with Ethereum Network Automation. As the project evolves, the updates to this document will ensure it remains a valuable resource.