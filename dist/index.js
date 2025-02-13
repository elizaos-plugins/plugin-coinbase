// src/plugins/massPayments.ts
import { Coinbase as Coinbase3 } from "@coinbase/coinbase-sdk";
import {
  composeContext,
  elizaLogger as elizaLogger2,
  generateObject,
  ModelClass
} from "@elizaos/core";

// src/types.ts
import { Coinbase } from "@coinbase/coinbase-sdk";
import { z } from "zod";
import {
  WebhookEventType
} from "@coinbase/coinbase-sdk/dist/client";
var ChargeSchema = z.object({
  id: z.string().nullable(),
  price: z.number(),
  type: z.string(),
  currency: z.string().min(3).max(3),
  name: z.string().min(1),
  description: z.string().min(1)
});
var isChargeContent = (object) => {
  if (ChargeSchema.safeParse(object).success) {
    return true;
  }
  console.error("Invalid content: ", object);
  return false;
};
var TransferSchema = z.object({
  network: z.string().toLowerCase(),
  receivingAddresses: z.array(z.string()),
  transferAmount: z.number(),
  assetId: z.string().toLowerCase()
});
var isTransferContent = (object) => {
  return TransferSchema.safeParse(object).success;
};
var assetValues = Object.values(Coinbase.assets);
var TradeSchema = z.object({
  network: z.string().toLowerCase(),
  amount: z.number(),
  sourceAsset: z.enum(assetValues),
  targetAsset: z.enum(assetValues),
  side: z.enum(["BUY", "SELL"])
});
var isTradeContent = (object) => {
  return TradeSchema.safeParse(object).success;
};
var TokenContractSchema = z.object({
  contractType: z.enum(["ERC20", "ERC721", "ERC1155"]).describe("The type of token contract to deploy"),
  name: z.string().describe("The name of the token"),
  symbol: z.string().describe("The symbol of the token"),
  network: z.string().describe("The blockchain network to deploy on"),
  baseURI: z.string().optional().describe(
    "The base URI for token metadata (required for ERC721 and ERC1155)"
  ),
  totalSupply: z.number().optional().describe("The total supply of tokens (only for ERC20)")
}).refine(
  (data) => {
    if (data.contractType === "ERC20") {
      return typeof data.totalSupply === "number" || data.totalSupply === void 0;
    }
    if (["ERC721", "ERC1155"].includes(data.contractType)) {
      return typeof data.baseURI === "string" || data.baseURI === void 0;
    }
    return true;
  },
  {
    message: "Invalid token contract content",
    path: ["contractType"]
  }
);
var isTokenContractContent = (obj) => {
  return TokenContractSchema.safeParse(obj).success;
};
var ContractInvocationSchema = z.object({
  contractAddress: z.string().describe("The address of the contract to invoke"),
  method: z.string().describe("The method to invoke on the contract"),
  abi: z.array(z.any()).describe("The ABI of the contract"),
  args: z.record(z.string(), z.any()).optional().describe("The arguments to pass to the contract method"),
  amount: z.string().optional().describe(
    "The amount of the asset to send (as string to handle large numbers)"
  ),
  assetId: z.string().describe("The ID of the asset to send (e.g., 'USDC')"),
  networkId: z.string().describe("The network ID to use (e.g., 'ethereum-mainnet')")
});
var isContractInvocationContent = (obj) => {
  return ContractInvocationSchema.safeParse(obj).success;
};
var WebhookSchema = z.object({
  networkId: z.string(),
  eventType: z.nativeEnum(WebhookEventType),
  eventTypeFilter: z.custom().optional(),
  eventFilters: z.array(z.custom()).optional()
});
var isWebhookContent = (object) => {
  return WebhookSchema.safeParse(object).success;
};
var AdvancedTradeSchema = z.object({
  productId: z.string(),
  side: z.enum(["BUY", "SELL"]),
  amount: z.number(),
  orderType: z.enum(["MARKET", "LIMIT"]),
  limitPrice: z.number().optional()
});
var isAdvancedTradeContent = (object) => {
  return AdvancedTradeSchema.safeParse(object).success;
};
var ReadContractSchema = z.object({
  contractAddress: z.string().describe("The address of the contract to read from"),
  method: z.string().describe("The view/pure method to call on the contract"),
  networkId: z.string().describe("The network ID to use"),
  args: z.record(z.string(), z.any()).describe("The arguments to pass to the contract method"),
  abi: z.array(z.any()).optional().describe("The contract ABI (optional)")
});
var isReadContractContent = (obj) => {
  return ReadContractSchema.safeParse(obj).success;
};

// src/templates.ts
var chargeTemplate = `
Extract the following details to create a Coinbase charge:
- **price** (number): The amount for the charge (e.g., 100.00).
- **currency** (string): The 3-letter ISO 4217 currency code (e.g., USD, EUR).
- **type** (string): The pricing type for the charge (e.g., fixed_price, dynamic_price). Assume price type is fixed unless otherwise stated
- **name** (string): A non-empty name for the charge (e.g., "The Human Fund").
- **description** (string): A non-empty description of the charge (e.g., "Money For People").

Provide the values in the following JSON format:

\`\`\`json
{
    "price": <number>,
    "currency": "<currency>",
    "type": "<type>",
    "name": "<name>",
    "description": "<description>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var getChargeTemplate = `
Extract the details for a Coinbase charge using the provided charge ID:
- **charge_id** (string): The unique identifier of the charge (e.g., "2b364ef7-ad60-4fcd-958b-e550a3c47dc6").

Provide the charge details in the following JSON format after retrieving the charge details:

\`\`\`json
{
    "charge_id": "<charge_id>",
    "price": <number>,
    "currency": "<currency>",
    "type": "<type>",
    "name": "<name>",
    "description": "<description>",
    "status": "<status>",
    "created_at": "<ISO8601 timestamp>",
    "expires_at": "<ISO8601 timestamp>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var transferTemplate = `
Extract the following details for processing a mass payout using the Coinbase SDK:
- **receivingAddresses** (array): A list of wallet addresses receiving the funds.
- **transferAmount** (number): The amount to transfer to each address.
- **assetId** (string): The asset ID to transfer (e.g., ETH, BTC).
- **network** (string): The blockchain network to use. Allowed values are:
    static networks: {
        readonly BaseSepolia: "base-sepolia";
        readonly BaseMainnet: "base-mainnet";
        readonly EthereumHolesky: "ethereum-holesky";
        readonly EthereumMainnet: "ethereum-mainnet";
        readonly PolygonMainnet: "polygon-mainnet";
        readonly SolanaDevnet: "solana-devnet";
        readonly SolanaMainnet: "solana-mainnet";
        readonly ArbitrumMainnet: "arbitrum-mainnet";
    };

Provide the details in the following JSON format:

\`\`\`json
{
    "receivingAddresses": ["<receiving_address_1>", "<receiving_address_2>"],
    "transferAmount": <amount>,
    "assetId": "<asset_id>",
    "network": "<network>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var tradeTemplate = `
Extract the following details for processing a trade using the Coinbase SDK:
- **network** (string): The blockchain network to use (e.g., base, sol, eth, arb, pol).
- **amount** (number): The amount to trade.
- **sourceAsset** (string): The asset ID to trade from (must be one of: ETH, SOL, USDC, WETH, GWEI, LAMPORT).
- **targetAsset** (string): The asset ID to trade to (must be one of: ETH, SOL, USDC, WETH, GWEI, LAMPORT).
- **side** (string): The side of the trade (must be either "BUY" or "SELL").

Ensure that:
1. **network** is one of the supported networks: "base", "sol", "eth", "arb", or "pol".
2. **sourceAsset** and **targetAsset** are valid assets from the provided list.
3. **amount** is a positive number.
4. **side** is either "BUY" or "SELL".

Provide the details in the following JSON format:

\`\`\`json
{
    "network": "<network>",
    "amount": <amount>,
    "sourceAsset": "<source_asset_id>",
    "targetAsset": "<target_asset_id>",
    "side": "<side>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var advancedTradeTemplate = `
Extract the following details for processing an advanced trade using the Coinbase Advanced Trading API:
- **productId** (string): The trading pair ID (e.g., "BTC-USD", "ETH-USD", "SOL-USD")
- **side** (string): The side of the trade (must be either "BUY" or "SELL")
- **amount** (number): The amount to trade
- **orderType** (string): The type of order (must be either "MARKET" or "LIMIT")
- **limitPrice** (number, optional): The limit price for limit orders

Ensure that:
1. **productId** follows the format "ASSET-USD" (e.g., "BTC-USD")
2. **side** is either "BUY" or "SELL"
3. **amount** is a positive number
4. **orderType** is either "MARKET" or "LIMIT"
5. **limitPrice** is provided when orderType is "LIMIT"

Provide the details in the following JSON format:

\`\`\`json
{
    "productId": "<product_id>",
    "side": "<side>",
    "amount": <amount>,
    "orderType": "<order_type>",
    "limitPrice": <limit_price>
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var tokenContractTemplate = `
Extract the following details for deploying a token contract using the Coinbase SDK:
- **contractType** (string): The type of token contract to deploy (ERC20, ERC721, or ERC1155)
- **name** (string): The name of the token
- **symbol** (string): The symbol of the token
- **network** (string): The blockchain network to deploy on (e.g., base, eth, arb, pol)
- **baseURI** (string, optional): The base URI for token metadata (required for ERC721 and ERC1155)
- **totalSupply** (number, optional): The total supply of tokens (only for ERC20)

Provide the details in the following JSON format:

\`\`\`json
{
    "contractType": "<contract_type>",
    "name": "<token_name>",
    "symbol": "<token_symbol>",
    "network": "<network>",
    "baseURI": "<base_uri>",
    "totalSupply": <total_supply>
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var contractInvocationTemplate = `
Extract the following details for invoking a smart contract using the Coinbase SDK:
- **contractAddress** (string): The address of the contract to invoke
- **method** (string): The method to invoke on the contract
- **abi** (array): The ABI of the contract
- **args** (object, optional): The arguments to pass to the contract method
- **amount** (string, optional): The amount of the asset to send (as string to handle large numbers)
- **assetId** (string, required): The ID of the asset to send (e.g., 'USDC')
- **networkId** (string, required): The network ID to use in format "chain-network".
 static networks: {
        readonly BaseSepolia: "base-sepolia";
        readonly BaseMainnet: "base-mainnet";
        readonly EthereumHolesky: "ethereum-holesky";
        readonly EthereumMainnet: "ethereum-mainnet";
        readonly PolygonMainnet: "polygon-mainnet";
        readonly SolanaDevnet: "solana-devnet";
        readonly SolanaMainnet: "solana-mainnet";
        readonly ArbitrumMainnet: "arbitrum-mainnet";
    };

Provide the details in the following JSON format:

\`\`\`json
{
    "contractAddress": "<contract_address>",
    "method": "<method_name>",
    "abi": [<contract_abi>],
    "args": {
        "<arg_name>": "<arg_value>"
    },
    "amount": "<amount_as_string>",
    "assetId": "<asset_id>",
    "networkId": "<network_id>"
}
\`\`\`

Example for invoking a transfer method on the USDC contract:

\`\`\`json
{
    "contractAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "method": "transfer",
    "abi": [
        {
            "constant": false,
            "inputs": [
                {
                    "name": "to",
                    "type": "address"
                },
                {
                    "name": "amount",
                    "type": "uint256"
                }
            ],
            "name": "transfer",
            "outputs": [
                {
                    "name": "",
                    "type": "bool"
                }
            ],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ],
    "args": {
        "to": "0xbcF7C64B880FA89a015970dC104E848d485f99A3",
        "amount": "1000000" // 1 USDC (6 decimals)
    },
    "networkId": "ethereum-mainnet",
    "assetId": "USDC"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var webhookTemplate = `
Extract the following details for creating a webhook:
- **networkId** (string): The network ID for which the webhook is created.
Allowed values are:
    static networks: {
        readonly BaseSepolia: "base-sepolia";
        readonly BaseMainnet: "base-mainnet";
        readonly EthereumHolesky: "ethereum-holesky";
        readonly EthereumMainnet: "ethereum-mainnet";
        readonly PolygonMainnet: "polygon-mainnet";
        readonly SolanaDevnet: "solana-devnet";
        readonly SolanaMainnet: "solana-mainnet";
        readonly ArbitrumMainnet: "arbitrum-mainnet";
    };
- **eventType** (string): The type of event for the webhook.
export declare const WebhookEventType: {
    readonly Unspecified: "unspecified";
    readonly Erc20Transfer: "erc20_transfer";
    readonly Erc721Transfer: "erc721_transfer";
    readonly WalletActivity: "wallet_activity";
};
- **eventTypeFilter** (string, optional): Filter for wallet activity event type.
export interface WebhookEventTypeFilter {
    /**
     * A list of wallet addresses to filter on.
     * @type {Array<string>}
     * @memberof WebhookWalletActivityFilter
     */
    'addresses'?: Array<string>;
    /**
     * The ID of the wallet that owns the webhook.
     * @type {string}
     * @memberof WebhookWalletActivityFilter
     */
    'wallet_id'?: string;
}
- **eventFilters** (array, optional): Filters applied to the events that determine which specific events trigger the webhook.
export interface Array<WebhookEventFilter> {
    /**
     * The onchain contract address of the token for which the events should be tracked.
     * @type {string}
     * @memberof WebhookEventFilter
     */
    'contract_address'?: string;
    /**
     * The onchain address of the sender. Set this filter to track all transfer events originating from your address.
     * @type {string}
     * @memberof WebhookEventFilter
     */
    'from_address'?: string;
    /**
     * The onchain address of the receiver. Set this filter to track all transfer events sent to your address.
     * @type {string}
     * @memberof WebhookEventFilter
     */
    'to_address'?: string;
}
Provide the details in the following JSON format:
\`\`\`json
{
    "networkId": "<networkId>",
    "eventType": "<eventType>",
    "eventTypeFilter": "<eventTypeFilter>",
    "eventFilters": [<eventFilter1>, <eventFilter2>]
}
\`\`\`



Example for creating a webhook on the Sepolia testnet for ERC20 transfers originating from a specific wallet 0x1234567890123456789012345678901234567890 on transfers from 0xbcF7C64B880FA89a015970dC104E848d485f99A3

\`\`\`javascript

    networkId: 'base-sepolia', // Listening on sepolia testnet transactions
    eventType: 'erc20_transfer',
    eventTypeFilter: {
      addresses: ['0x1234567890123456789012345678901234567890']
    },
    eventFilters: [{
      from_address: '0xbcF7C64B880FA89a015970dC104E848d485f99A3',
    }],
});
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var readContractTemplate = `
Extract the following details for reading from a smart contract using the Coinbase SDK:
- **contractAddress** (string): The address of the contract to read from (must start with 0x)
- **method** (string): The view/pure method to call on the contract
- **networkId** (string): The network ID based on networks configured in Coinbase SDK
Allowed values are:
    static networks: {
        readonly BaseSepolia: "base-sepolia";
        readonly BaseMainnet: "base-mainnet";
        readonly EthereumHolesky: "ethereum-holesky";
        readonly EthereumMainnet: "ethereum-mainnet";
        readonly PolygonMainnet: "polygon-mainnet";
        readonly SolanaDevnet: "solana-devnet";
        readonly SolanaMainnet: "solana-mainnet";
        readonly ArbitrumMainnet: "arbitrum-mainnet";
    };
- **args** (object): The arguments to pass to the contract method
- **abi** (array, optional): The contract ABI if needed for complex interactions

Provide the details in the following JSON format:

\`\`\`json
{
    "contractAddress": "<0x-prefixed-address>",
    "method": "<method_name>",
    "networkId": "<network_id>",
    "args": {
        "<arg_name>": "<arg_value>"
    },
    "abi": [
        // Optional ABI array
    ]
}
\`\`\`

Example for reading the balance of an ERC20 token:

\`\`\`json
{
    "contractAddress": "0x37f2131ebbc8f97717edc3456879ef56b9f4b97b",
    "method": "balanceOf",
    "networkId": "eth-mainnet",
    "args": {
        "account": "0xbcF7C64B880FA89a015970dC104E848d485f99A3"
    }
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// src/plugins/massPayments.ts
import { readFile } from "fs/promises";
import { parse } from "csv-parse/sync";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import fs2 from "fs";
import { createArrayCsvWriter as createArrayCsvWriter2 } from "csv-writer";

// src/utils.ts
import {
  Coinbase as Coinbase2,
  Wallet
} from "@coinbase/coinbase-sdk";
import { elizaLogger, settings } from "@elizaos/core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createArrayCsvWriter } from "csv-writer";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var baseDir = path.resolve(__dirname, "../../plugin-coinbase/src/plugins");
var tradeCsvFilePath = path.join(baseDir, "trades.csv");
var transactionCsvFilePath = path.join(baseDir, "transactions.csv");
var webhookCsvFilePath = path.join(baseDir, "webhooks.csv");
async function initializeWallet(runtime, networkId = Coinbase2.networks.EthereumMainnet) {
  let wallet;
  const storedSeed = runtime.getSetting("COINBASE_GENERATED_WALLET_HEX_SEED") ?? process.env.COINBASE_GENERATED_WALLET_HEX_SEED;
  const storedWalletId = runtime.getSetting("COINBASE_GENERATED_WALLET_ID") ?? process.env.COINBASE_GENERATED_WALLET_ID;
  if (!storedSeed || !storedWalletId) {
    wallet = await Wallet.create({ networkId });
    const walletData = wallet.export();
    const walletAddress = await wallet.getDefaultAddress();
    try {
      const characterFilePath = `characters/${runtime.character.name.toLowerCase()}.character.json`;
      const walletIDSave = await updateCharacterSecrets(
        characterFilePath,
        "COINBASE_GENERATED_WALLET_ID",
        walletData.walletId
      );
      const seedSave = await updateCharacterSecrets(
        characterFilePath,
        "COINBASE_GENERATED_WALLET_HEX_SEED",
        walletData.seed
      );
      if (walletIDSave && seedSave) {
        elizaLogger.log("Successfully updated character secrets.");
      } else {
        const seedFilePath = `characters/${runtime.character.name.toLowerCase()}-seed.txt`;
        elizaLogger.error(
          `Failed to update character secrets so adding gitignored ${seedFilePath} file please add it your env or character file and delete:`
        );
        wallet.saveSeed(seedFilePath);
      }
      elizaLogger.log(
        "Wallet created and stored new wallet:",
        walletAddress
      );
    } catch (error) {
      elizaLogger.error("Error updating character secrets:", error);
      throw error;
    }
    elizaLogger.log("Created and stored new wallet:", walletAddress);
  } else {
    wallet = await Wallet.import({
      seed: storedSeed,
      walletId: storedWalletId
    });
    const networkId2 = wallet.getNetworkId();
    elizaLogger.log("Imported existing wallet for network:", networkId2);
    elizaLogger.log(
      "Imported existing wallet:",
      await wallet.getDefaultAddress()
    );
  }
  return wallet;
}
async function executeTradeAndCharityTransfer(runtime, network, amount, sourceAsset, targetAsset) {
  const wallet = await initializeWallet(runtime, network);
  elizaLogger.log("Wallet initialized:", {
    network,
    address: await wallet.getDefaultAddress()
  });
  const charityAddress = getCharityAddress(network);
  const charityAmount = charityAddress ? amount * 0.01 : 0;
  const tradeAmount = charityAddress ? amount - charityAmount : amount;
  const assetIdLowercase = sourceAsset.toLowerCase();
  const tradeParams = {
    amount: tradeAmount,
    fromAssetId: assetIdLowercase,
    toAssetId: targetAsset.toLowerCase()
  };
  let transfer;
  if (charityAddress && charityAmount > 0) {
    transfer = await executeTransfer(
      wallet,
      charityAmount,
      assetIdLowercase,
      charityAddress
    );
    elizaLogger.log("Charity Transfer successful:", {
      address: charityAddress,
      transactionUrl: transfer.getTransactionLink()
    });
    await appendTransactionsToCsv([
      {
        address: charityAddress,
        amount: charityAmount,
        status: "Success",
        errorCode: null,
        transactionUrl: transfer.getTransactionLink()
      }
    ]);
  }
  const trade = await wallet.createTrade(tradeParams);
  elizaLogger.log("Trade initiated:", trade.toString());
  await trade.wait();
  elizaLogger.log("Trade completed successfully:", trade.toString());
  await appendTradeToCsv(trade);
  return {
    trade,
    transfer
  };
}
async function appendTradeToCsv(trade) {
  try {
    const csvWriter = createArrayCsvWriter({
      path: tradeCsvFilePath,
      header: [
        "Network",
        "From Amount",
        "Source Asset",
        "To Amount",
        "Target Asset",
        "Status",
        "Transaction URL"
      ],
      append: true
    });
    const formattedTrade = [
      trade.getNetworkId(),
      trade.getFromAmount(),
      trade.getFromAssetId(),
      trade.getToAmount(),
      trade.getToAssetId(),
      trade.getStatus(),
      trade.getTransaction().getTransactionLink() || ""
    ];
    elizaLogger.log("Writing trade to CSV:", formattedTrade);
    await csvWriter.writeRecords([formattedTrade]);
    elizaLogger.log("Trade written to CSV successfully.");
  } catch (error) {
    elizaLogger.error("Error writing trade to CSV:", error);
  }
}
async function appendTransactionsToCsv(transactions) {
  try {
    const csvWriter = createArrayCsvWriter({
      path: transactionCsvFilePath,
      header: [
        "Address",
        "Amount",
        "Status",
        "Error Code",
        "Transaction URL"
      ],
      append: true
    });
    const formattedTransactions = transactions.map((transaction) => [
      transaction.address,
      transaction.amount.toString(),
      transaction.status,
      transaction.errorCode || "",
      transaction.transactionUrl || ""
    ]);
    elizaLogger.log("Writing transactions to CSV:", formattedTransactions);
    await csvWriter.writeRecords(formattedTransactions);
    elizaLogger.log("All transactions written to CSV successfully.");
  } catch (error) {
    elizaLogger.error("Error writing transactions to CSV:", error);
  }
}
async function appendWebhooksToCsv(webhooks) {
  try {
    if (!fs.existsSync(webhookCsvFilePath)) {
      elizaLogger.warn("CSV file not found. Creating a new one.");
      const csvWriter2 = createArrayCsvWriter({
        path: webhookCsvFilePath,
        header: [
          "Webhook ID",
          "Network ID",
          "Event Type",
          "Event Filters",
          "Event Type Filter",
          "Notification URI"
        ]
      });
      await csvWriter2.writeRecords([]);
      elizaLogger.log("New CSV file created with headers.");
    }
    const csvWriter = createArrayCsvWriter({
      path: webhookCsvFilePath,
      header: [
        "Webhook ID",
        "Network ID",
        "Event Type",
        "Event Filters",
        "Event Type Filter",
        "Notification URI"
      ],
      append: true
    });
    const formattedWebhooks = webhooks.map((webhook) => [
      webhook.getId(),
      webhook.getNetworkId(),
      webhook.getEventType(),
      JSON.stringify(webhook.getEventFilters()),
      JSON.stringify(webhook.getEventTypeFilter()),
      webhook.getNotificationURI()
    ]);
    elizaLogger.log("Writing webhooks to CSV:", formattedWebhooks);
    await csvWriter.writeRecords(formattedWebhooks);
    elizaLogger.log("All webhooks written to CSV successfully.");
  } catch (error) {
    elizaLogger.error("Error writing webhooks to CSV:", error);
  }
}
async function updateCharacterSecrets(characterfilePath, key, value) {
  try {
    const characterFilePath = path.resolve(
      process.cwd(),
      characterfilePath
    );
    if (!fs.existsSync(characterFilePath)) {
      elizaLogger.error("Character file not found:", characterFilePath);
      return false;
    }
    const characterData = JSON.parse(
      fs.readFileSync(characterFilePath, "utf-8")
    );
    if (!characterData.settings) {
      characterData.settings = {};
    }
    if (!characterData.settings.secrets) {
      characterData.settings.secrets = {};
    }
    characterData.settings.secrets[key] = value;
    fs.writeFileSync(
      characterFilePath,
      JSON.stringify(characterData, null, 2),
      "utf-8"
    );
    console.log(
      `Updated ${key} in character.settings.secrets for ${characterFilePath}.`
    );
  } catch (error) {
    elizaLogger.error("Error updating character secrets:", error);
    return false;
  }
  return true;
}
var getAssetType = (transaction) => {
  if (transaction.value && transaction.value !== "0") {
    return "ETH";
  }
  if (transaction.token_transfers && transaction.token_transfers.length > 0) {
    return transaction.token_transfers.map((transfer) => {
      return transfer.token_id;
    }).join(", ");
  }
  return "N/A";
};
async function getWalletDetails(runtime, networkId = Coinbase2.networks.EthereumMainnet) {
  try {
    const wallet = await initializeWallet(runtime, networkId);
    const balances = await wallet.listBalances();
    const formattedBalances = Array.from(balances, (balance) => ({
      asset: balance[0],
      amount: balance[1].toString()
    }));
    const transactionsData = [];
    const formattedTransactions = transactionsData.map((transaction) => {
      const content = transaction.content();
      return {
        timestamp: content.block_timestamp || "N/A",
        amount: content.value || "N/A",
        asset: getAssetType(content) || "N/A",
        // Ensure getAssetType is implemented
        status: transaction.getStatus(),
        transactionUrl: transaction.getTransactionLink() || "N/A"
      };
    });
    return {
      balances: formattedBalances,
      transactions: formattedTransactions
    };
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    throw new Error("Unable to retrieve wallet details.");
  }
}
async function executeTransfer(wallet, amount, sourceAsset, targetAddress) {
  const assetIdLowercase = sourceAsset.toLowerCase();
  const transferDetails = {
    amount,
    assetId: assetIdLowercase,
    destination: targetAddress,
    gasless: assetIdLowercase === "usdc" ? true : false
  };
  elizaLogger.log("Initiating transfer:", transferDetails);
  let transfer;
  try {
    transfer = await wallet.createTransfer(transferDetails);
    elizaLogger.log("Transfer initiated:", transfer.toString());
    await transfer.wait({
      intervalSeconds: 1,
      timeoutSeconds: 20
    });
  } catch (error) {
    elizaLogger.error("Error executing transfer:", error);
  }
  return transfer;
}
function getCharityAddress(network, isCharitable = false) {
  const isCharityEnabled = process.env.IS_CHARITABLE === "true" && isCharitable;
  if (!isCharityEnabled) {
    return null;
  }
  const networkKey = `CHARITY_ADDRESS_${network.toUpperCase()}`;
  const charityAddress = settings[networkKey];
  if (!charityAddress) {
    throw new Error(
      `Charity address not configured for network ${network}. Please set ${networkKey} in your environment variables.`
    );
  }
  return charityAddress;
}

// src/plugins/massPayments.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var baseDir2 = path2.resolve(__dirname2, "../../plugin-coinbase/src/plugins");
var csvFilePath = path2.join(baseDir2, "transactions.csv");
var massPayoutProvider = {
  get: async (runtime, _message) => {
    elizaLogger2.debug("Starting massPayoutProvider.get function");
    try {
      Coinbase3.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      elizaLogger2.info("Reading CSV file from:", csvFilePath);
      if (!fs2.existsSync(csvFilePath)) {
        elizaLogger2.warn("CSV file not found. Creating a new one.");
        const csvWriter = createArrayCsvWriter2({
          path: csvFilePath,
          header: [
            "Address",
            "Amount",
            "Status",
            "Error Code",
            "Transaction URL"
          ]
        });
        await csvWriter.writeRecords([]);
        elizaLogger2.info("New CSV file created with headers.");
      }
      const csvData = await readFile(csvFilePath, "utf-8");
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true
      });
      const { balances, transactions } = await getWalletDetails(runtime);
      elizaLogger2.info("Parsed CSV records:", records);
      elizaLogger2.info("Current Balances:", balances);
      elizaLogger2.info("Last Transactions:", transactions);
      return {
        currentTransactions: records.map((record) => ({
          address: record["Address"] || void 0,
          amount: Number.parseFloat(record["Amount"]) || void 0,
          status: record["Status"] || void 0,
          errorCode: record["Error Code"] || "",
          transactionUrl: record["Transaction URL"] || ""
        })),
        balances,
        transactionHistory: transactions
      };
    } catch (error) {
      elizaLogger2.error("Error in massPayoutProvider:", error);
      return { csvRecords: [], balances: [], transactions: [] };
    }
  }
};
async function executeMassPayout(runtime, networkId, receivingAddresses, transferAmount, assetId) {
  elizaLogger2.debug("Starting executeMassPayout function");
  const transactions = [];
  const assetIdLowercase = assetId.toLowerCase();
  let sendingWallet;
  try {
    elizaLogger2.debug("Initializing sending wallet");
    sendingWallet = await initializeWallet(runtime, networkId);
  } catch (error) {
    elizaLogger2.error("Error initializing sending wallet:", error);
    throw error;
  }
  for (const address of receivingAddresses) {
    elizaLogger2.info("Processing payout for address:", address);
    if (address) {
      try {
        const walletBalance = await sendingWallet.getBalance(assetIdLowercase);
        elizaLogger2.info("Wallet balance for asset:", {
          assetId,
          walletBalance
        });
        if (walletBalance.lessThan(transferAmount)) {
          const insufficientFunds = `Insufficient funds for address ${sendingWallet.getDefaultAddress()} to send to ${address}. Required: ${transferAmount}, Available: ${walletBalance}`;
          elizaLogger2.error(insufficientFunds);
          transactions.push({
            address,
            amount: transferAmount,
            status: "Failed",
            errorCode: insufficientFunds,
            transactionUrl: null
          });
          continue;
        }
        const transfer = await executeTransfer(
          sendingWallet,
          transferAmount,
          assetIdLowercase,
          address
        );
        transactions.push({
          address,
          amount: transfer.getAmount().toNumber(),
          status: "Success",
          errorCode: null,
          transactionUrl: transfer.getTransactionLink()
        });
      } catch (error) {
        elizaLogger2.error(
          "Error during transfer for address:",
          address,
          error
        );
        transactions.push({
          address,
          amount: transferAmount,
          status: "Failed",
          errorCode: error?.code || "Unknown Error",
          transactionUrl: null
        });
      }
    } else {
      elizaLogger2.info("Skipping invalid or empty address.");
      transactions.push({
        address: "Invalid or Empty",
        amount: transferAmount,
        status: "Failed",
        errorCode: "Invalid Address",
        transactionUrl: null
      });
    }
  }
  const charityAddress = getCharityAddress(networkId);
  try {
    elizaLogger2.debug("Sending 1% to charity:", charityAddress);
    const charityTransfer = await executeTransfer(
      sendingWallet,
      transferAmount * 0.01,
      assetId,
      charityAddress
    );
    transactions.push({
      address: charityAddress,
      amount: charityTransfer.getAmount().toNumber(),
      status: "Success",
      errorCode: null,
      transactionUrl: charityTransfer.getTransactionLink()
    });
  } catch (error) {
    elizaLogger2.error("Error during charity transfer:", error);
    transactions.push({
      address: charityAddress,
      amount: transferAmount * 0.01,
      status: "Failed",
      errorCode: error?.message || "Unknown Error",
      transactionUrl: null
    });
  }
  await appendTransactionsToCsv(transactions);
  elizaLogger2.info("Finished processing mass payouts.");
  return transactions;
}
var sendMassPayoutAction = {
  name: "SEND_MASS_PAYOUT",
  similes: ["BULK_TRANSFER", "DISTRIBUTE_FUNDS", "SEND_PAYMENTS"],
  description: "Sends mass payouts to a list of receiving addresses using a predefined sending wallet and logs all transactions to a CSV file.",
  validate: async (runtime, _message) => {
    elizaLogger2.info("Validating runtime and message...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger2.debug("Starting SEND_MASS_PAYOUT handler...");
    try {
      Coinbase3.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      if (!state) {
        state = await runtime.composeState(message, {
          providers: [massPayoutProvider]
        });
      } else {
        state = await runtime.updateRecentMessageState(state);
      }
      const context = composeContext({
        state,
        template: transferTemplate
      });
      const transferDetails = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
        schema: TransferSchema
      });
      elizaLogger2.info(
        "Transfer details generated:",
        transferDetails.object
      );
      if (!isTransferContent(transferDetails.object)) {
        callback(
          {
            text: "Invalid transfer details. Please check the inputs."
          },
          []
        );
        return;
      }
      const { receivingAddresses, transferAmount, assetId, network } = transferDetails.object;
      const allowedNetworks = Object.values(Coinbase3.networks);
      if (!network || !allowedNetworks.includes(network.toLowerCase()) || !receivingAddresses?.length || transferAmount <= 0 || !assetId) {
        elizaLogger2.error("Missing or invalid input parameters:", {
          network,
          receivingAddresses,
          transferAmount,
          assetId
        });
        callback(
          {
            text: `Invalid input parameters. Please ensure:
- Network is one of: ${allowedNetworks.join(", ")}.
- Receiving addresses are provided.
- Transfer amount is greater than zero.
- Asset ID is valid.`
          },
          []
        );
        return;
      }
      elizaLogger2.info("\u25CE Starting mass payout...");
      const transactions = await executeMassPayout(
        runtime,
        network,
        receivingAddresses,
        transferAmount,
        assetId
      );
      const successTransactions = transactions.filter(
        (tx) => tx.status === "Success"
      );
      const failedTransactions = transactions.filter(
        (tx) => tx.status === "Failed"
      );
      const successDetails = successTransactions.map(
        (tx) => `Address: ${tx.address}, Amount: ${tx.amount}, Transaction URL: ${tx.transactionUrl || "N/A"}`
      ).join("\n");
      const failedDetails = failedTransactions.map(
        (tx) => `Address: ${tx.address}, Amount: ${tx.amount}, Error Code: ${tx.errorCode || "Unknown Error"}`
      ).join("\n");
      const charityTransactions = transactions.filter(
        (tx) => tx.address === getCharityAddress(network)
      );
      const charityDetails = charityTransactions.map(
        (tx) => `Address: ${tx.address}, Amount: ${tx.amount}, Transaction URL: ${tx.transactionUrl || "N/A"}`
      ).join("\n");
      callback(
        {
          text: `Mass payouts completed successfully.
- Successful Transactions: ${successTransactions.length}
- Failed Transactions: ${failedTransactions.length}

Details:
${successTransactions.length > 0 ? `\u2705 Successful Transactions:
${successDetails}` : "No successful transactions."}
${failedTransactions.length > 0 ? `\u274C Failed Transactions:
${failedDetails}` : "No failed transactions."}
${charityTransactions.length > 0 ? `\u2705 Charity Transactions:
${charityDetails}` : "No charity transactions."}

Check the CSV file for full details.`
        },
        []
      );
    } catch (error) {
      elizaLogger2.error("Error during mass payouts:", error);
      callback(
        { text: "Failed to complete payouts. Please try again." },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Distribute 0.0001 ETH on base to 0xA0ba2ACB5846A54834173fB0DD9444F756810f06 and 0xF14F2c49aa90BaFA223EE074C1C33b59891826bF"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Mass payouts completed successfully.
- Successful Transactions: {{2}}
- Failed Transactions: {{1}}

Details:
\u2705 Successful Transactions:
Address: 0xABC123..., Amount: 0.005, Transaction URL: https://etherscan.io/tx/...
Address: 0xDEF456..., Amount: 0.005, Transaction URL: https://etherscan.io/tx/...

\u274C Failed Transactions:
Address: 0xGHI789..., Amount: 0.005, Error Code: Insufficient Funds

Check the CSV file for full details.`,
          action: "SEND_MASS_PAYOUT"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Airdrop 10 USDC to these community members: 0x789..., 0x101... on base network"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Mass payout completed successfully:\n- Airdropped 10 USDC to 2 addresses on base network\n- Successful Transactions: 2\n- Failed Transactions: 0\nCheck the CSV file for transaction details."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Multi-send 0.25 ETH to team wallets: 0x222..., 0x333... on Ethereum"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Mass payout completed successfully:\n- Multi-sent 0.25 ETH to 2 addresses on Ethereum network\n- Successful Transactions: 2\n- Failed Transactions: 0\nCheck the CSV file for transaction details."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Distribute rewards of 5 SOL each to contest winners: winner1.sol, winner2.sol on Solana"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Mass payout completed successfully:\n- Distributed 5 SOL to 2 addresses on Solana network\n- Successful Transactions: 2\n- Failed Transactions: 0\nCheck the CSV file for transaction details."
        }
      }
    ]
  ]
};
var coinbaseMassPaymentsPlugin = {
  name: "automatedPayments",
  description: "Processes mass payouts using Coinbase SDK and logs all transactions (success and failure) to a CSV file. Provides dynamic transaction data through a provider.",
  actions: [sendMassPayoutAction],
  providers: [massPayoutProvider]
};

// src/plugins/commerce.ts
import {
  composeContext as composeContext2,
  elizaLogger as elizaLogger3,
  generateObject as generateObject2,
  ModelClass as ModelClass2
} from "@elizaos/core";
import { Coinbase as Coinbase4 } from "@coinbase/coinbase-sdk";
var url = "https://api.commerce.coinbase.com/charges";
async function createCharge(apiKey, params) {
  elizaLogger3.debug("Starting createCharge function");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey
      },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      throw new Error(`Failed to create charge: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    elizaLogger3.error("Error creating charge:", error);
    throw error;
  }
}
async function getAllCharges(apiKey) {
  elizaLogger3.debug("Starting getAllCharges function");
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey
      }
    });
    if (!response.ok) {
      console.error("response.status", response.statusText);
      throw new Error(
        `Failed to fetch all charges: ${response.statusText}`
      );
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    elizaLogger3.error("Error fetching charges:", error);
    throw error;
  }
}
async function getChargeDetails(apiKey, chargeId) {
  elizaLogger3.debug("Starting getChargeDetails function");
  const getUrl = `${url}/${chargeId}`;
  try {
    const response = await fetch(getUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey
      }
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch charge details: ${response.statusText}`
      );
    }
    const data = await response.json();
    return data;
  } catch (error) {
    elizaLogger3.error(
      `Error fetching charge details for ID ${chargeId}:`,
      error
    );
    throw error;
  }
}
var createCoinbaseChargeAction = {
  name: "CREATE_CHARGE",
  similes: [
    "MAKE_CHARGE",
    "INITIATE_CHARGE",
    "GENERATE_CHARGE",
    "CREATE_TRANSACTION",
    "COINBASE_CHARGE",
    "GENERATE_INVOICE",
    "CREATE_PAYMENT",
    "SETUP_BILLING",
    "REQUEST_PAYMENT",
    "CREATE_CHECKOUT",
    "GET_CHARGE_STATUS",
    "LIST_CHARGES"
  ],
  description: "Create and manage payment charges using Coinbase Commerce. Supports fixed and dynamic pricing, multiple currencies (USD, EUR, USDC), and provides charge status tracking and management features.",
  validate: async (runtime, _message) => {
    const coinbaseCommerceKeyOk = !!runtime.getSetting(
      "COINBASE_COMMERCE_KEY"
    );
    return coinbaseCommerceKeyOk;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.info("Composing state for message:", message);
    if (!state) {
      state = await runtime.composeState(message);
    } else {
      state = await runtime.updateRecentMessageState(state);
    }
    const context = composeContext2({
      state,
      template: chargeTemplate
    });
    const chargeDetails = await generateObject2({
      runtime,
      context,
      modelClass: ModelClass2.LARGE,
      schema: ChargeSchema
    });
    if (!isChargeContent(chargeDetails.object)) {
      throw new Error("Invalid content");
    }
    const charge = chargeDetails.object;
    if (!charge || !charge.price || !charge.type) {
      callback(
        {
          text: "Invalid charge details provided."
        },
        []
      );
      return;
    }
    elizaLogger3.info("Charge details received:", chargeDetails);
    elizaLogger3.debug("Starting Coinbase Commerce client initialization");
    try {
      const chargeResponse = await createCharge(
        runtime.getSetting("COINBASE_COMMERCE_KEY"),
        {
          local_price: {
            amount: charge.price.toString(),
            currency: charge.currency
          },
          pricing_type: charge.type,
          name: charge.name,
          description: charge.description
        }
      );
      elizaLogger3.info(
        "Coinbase Commerce charge created:",
        chargeResponse
      );
      callback(
        {
          text: `Charge created successfully: ${chargeResponse.hosted_url}`,
          attachments: [
            {
              id: chargeResponse.id,
              url: chargeResponse.hosted_url,
              title: "Coinbase Commerce Charge",
              description: `Charge ID: ${chargeResponse.id}`,
              text: `Pay here: ${chargeResponse.hosted_url}`,
              source: "coinbase"
            }
          ]
        },
        []
      );
    } catch (error) {
      elizaLogger3.error(
        "Error creating Coinbase Commerce charge:",
        error
      );
      callback(
        {
          text: "Failed to create a charge. Please try again."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Create a charge for $100 USD for Digital Art NFT with description 'Exclusive digital artwork collection'"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge created successfully:\n- Amount: $100 USD\n- Name: Digital Art NFT\n- Description: Exclusive digital artwork collection\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Set up a dynamic price charge for Premium Membership named 'VIP Access Pass'"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge created successfully:\n- Type: dynamic_price\n- Name: VIP Access Pass\n- Description: Premium Membership\n- Charge URL: https://commerce.coinbase.com/charges/..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Generate a payment request for 50 EUR for Workshop Registration"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge created successfully:\n- Amount: 50 EUR\n- Name: Workshop Registration\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Create an invoice for 1000 USDC for Consulting Services"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge created successfully:\n- Amount: 1000 USDC\n- Name: Consulting Services\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Check the status of charge abc-123-def"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge details retrieved:\n- ID: abc-123-def\n- Status: COMPLETED\n- Amount: 100 USD\n- Created: 2024-01-20T10:00:00Z\n- Expires: 2024-01-21T10:00:00Z"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "List all active charges"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Active charges retrieved:\n1. ID: abc-123 - $100 USD - Digital Art NFT\n2. ID: def-456 - 50 EUR - Workshop\n3. ID: ghi-789 - 1000 USDC - Consulting\n\nTotal active charges: 3"
        }
      }
    ]
  ]
};
var getAllChargesAction = {
  name: "GET_ALL_CHARGES",
  similes: ["FETCH_ALL_CHARGES", "RETRIEVE_ALL_CHARGES", "LIST_ALL_CHARGES"],
  description: "Fetch all charges using Coinbase Commerce.",
  validate: async (runtime) => {
    const coinbaseCommerceKeyOk = !!runtime.getSetting(
      "COINBASE_COMMERCE_KEY"
    );
    return coinbaseCommerceKeyOk;
  },
  handler: async (runtime, message, state, _options, callback) => {
    try {
      elizaLogger3.info("Composing state for message:", message);
      if (!state) {
        state = await runtime.composeState(message);
      } else {
        state = await runtime.updateRecentMessageState(state);
      }
      const charges = await getAllCharges(
        runtime.getSetting("COINBASE_COMMERCE_KEY")
      );
      elizaLogger3.info("Fetched all charges:", charges);
      callback(
        {
          text: `Successfully fetched all charges. Total charges: ${charges.length}`,
          attachments: charges
        },
        []
      );
    } catch (error) {
      elizaLogger3.error("Error fetching all charges:", error);
      callback(
        {
          text: "Failed to fetch all charges. Please try again."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Fetch all charges" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Successfully fetched all charges.",
          action: "GET_ALL_CHARGES"
        }
      }
    ]
  ]
};
var getChargeDetailsAction = {
  name: "GET_CHARGE_DETAILS",
  similes: ["FETCH_CHARGE_DETAILS", "RETRIEVE_CHARGE_DETAILS", "GET_CHARGE"],
  description: "Fetch details of a specific charge using Coinbase Commerce.",
  validate: async (runtime) => {
    const coinbaseCommerceKeyOk = !!runtime.getSetting(
      "COINBASE_COMMERCE_KEY"
    );
    return coinbaseCommerceKeyOk;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.info("Composing state for message:", message);
    if (!state) {
      state = await runtime.composeState(message);
    } else {
      state = await runtime.updateRecentMessageState(state);
    }
    const context = composeContext2({
      state,
      template: getChargeTemplate
    });
    const chargeDetails = await generateObject2({
      runtime,
      context,
      modelClass: ModelClass2.LARGE,
      schema: ChargeSchema
    });
    if (!isChargeContent(chargeDetails.object)) {
      throw new Error("Invalid content");
    }
    const charge = chargeDetails.object;
    if (!charge.id) {
      callback(
        {
          text: "Missing charge ID. Please provide a valid charge ID."
        },
        []
      );
      return;
    }
    try {
      const chargeDetails2 = await getChargeDetails(
        runtime.getSetting("COINBASE_COMMERCE_KEY"),
        charge.id
      );
      elizaLogger3.info("Fetched charge details:", chargeDetails2);
      const chargeData = chargeDetails2.data;
      callback(
        {
          text: `Successfully fetched charge details for ID: ${charge.id}`,
          attachments: [
            {
              id: chargeData.id,
              url: chargeData.hosted_url,
              title: `Charge Details for ${charge.id}`,
              source: "coinbase",
              description: JSON.stringify(chargeDetails2, null, 2),
              text: `Pay here: ${chargeData.hosted_url}`,
              contentType: "application/json"
            }
          ]
        },
        []
      );
    } catch (error) {
      elizaLogger3.error(
        `Error fetching details for charge ID ${charge.id}:`,
        error
      );
      callback(
        {
          text: `Failed to fetch details for charge ID: ${charge.id}. Please try again.`
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Fetch details of charge ID: 123456"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Successfully fetched charge details. {{charge.id}} for {{charge.amount}} {{charge.currency}} to {{charge.name}} for {{charge.description}}",
          action: "GET_CHARGE_DETAILS"
        }
      }
    ]
  ]
};
var chargeProvider = {
  get: async (runtime, _message) => {
    elizaLogger3.debug("Starting chargeProvider.get function");
    const charges = await getAllCharges(
      runtime.getSetting("COINBASE_COMMERCE_KEY")
    );
    const coinbaseAPIKey = runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY;
    const coinbasePrivateKey = runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY;
    const balances = [];
    const transactions = [];
    if (coinbaseAPIKey && coinbasePrivateKey) {
      Coinbase4.configure({
        apiKeyName: coinbaseAPIKey,
        privateKey: coinbasePrivateKey
      });
      const { balances: balances2, transactions: transactions2 } = await getWalletDetails(runtime);
      elizaLogger3.info("Current Balances:", balances2);
      elizaLogger3.info("Last Transactions:", transactions2);
    }
    const formattedCharges = charges.map((charge) => ({
      id: charge.id,
      name: charge.name,
      description: charge.description,
      pricing: charge.pricing
    }));
    elizaLogger3.info("Charges:", formattedCharges);
    return { charges: formattedCharges, balances, transactions };
  }
};
var coinbaseCommercePlugin = {
  name: "coinbaseCommerce",
  description: "Integration with Coinbase Commerce for creating and managing charges.",
  actions: [
    createCoinbaseChargeAction,
    getAllChargesAction,
    getChargeDetailsAction
  ],
  evaluators: [],
  providers: [chargeProvider]
};

// src/plugins/trade.ts
import { Coinbase as Coinbase5 } from "@coinbase/coinbase-sdk";
import {
  elizaLogger as elizaLogger4,
  composeContext as composeContext3,
  generateObject as generateObject3,
  ModelClass as ModelClass3
} from "@elizaos/core";
import { readFile as readFile2 } from "fs/promises";
import { parse as parse2 } from "csv-parse/sync";
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import fs3 from "fs";
import { createArrayCsvWriter as createArrayCsvWriter3 } from "csv-writer";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path3.dirname(__filename3);
var baseDir3 = path3.resolve(__dirname3, "../../plugin-coinbase/src/plugins");
var tradeCsvFilePath2 = path3.join(baseDir3, "trades.csv");
var tradeProvider = {
  get: async (runtime, _message) => {
    elizaLogger4.debug("Starting tradeProvider.get function");
    try {
      Coinbase5.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      elizaLogger4.info("Reading CSV file from:", tradeCsvFilePath2);
      if (!fs3.existsSync(tradeCsvFilePath2)) {
        elizaLogger4.warn("CSV file not found. Creating a new one.");
        const csvWriter = createArrayCsvWriter3({
          path: tradeCsvFilePath2,
          header: [
            "Network",
            "From Amount",
            "Source Asset",
            "To Amount",
            "Target Asset",
            "Status",
            "Transaction URL"
          ]
        });
        await csvWriter.writeRecords([]);
        elizaLogger4.info("New CSV file created with headers.");
      }
      const csvData = await readFile2(tradeCsvFilePath2, "utf-8");
      const records = parse2(csvData, {
        columns: true,
        skip_empty_lines: true
      });
      elizaLogger4.info("Parsed CSV records:", records);
      const { balances, transactions } = await getWalletDetails(runtime);
      elizaLogger4.info("Current Balances:", balances);
      elizaLogger4.info("Last Transactions:", transactions);
      return {
        currentTrades: records.map((record) => ({
          network: record["Network"] || void 0,
          amount: Number.parseFloat(record["From Amount"]) || void 0,
          sourceAsset: record["Source Asset"] || void 0,
          toAmount: Number.parseFloat(record["To Amount"]) || void 0,
          targetAsset: record["Target Asset"] || void 0,
          status: record["Status"] || void 0,
          transactionUrl: record["Transaction URL"] || ""
        })),
        balances,
        transactions
      };
    } catch (error) {
      elizaLogger4.error("Error in tradeProvider:", error);
      return [];
    }
  }
};
var executeTradeAction = {
  name: "EXECUTE_TRADE",
  description: "Execute a trade between two assets using the Coinbase SDK and log the result.",
  validate: async (runtime, _message) => {
    elizaLogger4.info("Validating runtime for EXECUTE_TRADE...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger4.debug("Starting EXECUTE_TRADE handler...");
    try {
      Coinbase5.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const context = composeContext3({
        state,
        template: tradeTemplate
      });
      const tradeDetails = await generateObject3({
        runtime,
        context,
        modelClass: ModelClass3.LARGE,
        schema: TradeSchema
      });
      if (!isTradeContent(tradeDetails.object)) {
        callback(
          {
            text: "Invalid trade details. Ensure network, amount, source asset, and target asset are correctly specified."
          },
          []
        );
        return;
      }
      const { network, amount, sourceAsset, targetAsset } = tradeDetails.object;
      const allowedNetworks = ["base", "sol", "eth", "arb", "pol"];
      if (!allowedNetworks.includes(network)) {
        callback(
          {
            text: `Invalid network. Supported networks are: ${allowedNetworks.join(
              ", "
            )}.`
          },
          []
        );
        return;
      }
      const { trade, transfer } = await executeTradeAndCharityTransfer(
        runtime,
        network,
        amount,
        sourceAsset,
        targetAsset
      );
      let responseText = `Trade executed successfully:
- Network: ${network}
- Amount: ${trade.getFromAmount()}
- From: ${sourceAsset}
- To: ${targetAsset}
- Transaction URL: ${trade.getTransaction().getTransactionLink() || ""}
- Charity Transaction URL: ${transfer.getTransactionLink() || ""}`;
      if (transfer) {
        responseText += `
- Charity Amount: ${transfer.getAmount()}`;
      } else {
        responseText += "\n(Note: Charity transfer was not completed)";
      }
      callback({ text: responseText }, []);
    } catch (error) {
      elizaLogger4.error("Error during trade execution:", error);
      callback(
        {
          text: "Failed to execute the trade. Please check the logs for more details."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Swap 1 ETH for USDC on base network"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Swapped 1 ETH for USDC on base network\n- Transaction URL: https://basescan.io/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Convert 1000 USDC to SOL on Solana"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Converted 1000 USDC to SOL on Solana network\n- Transaction URL: https://solscan.io/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Exchange 5 WETH for ETH on Arbitrum"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Exchanged 5 WETH for ETH on Arbitrum network\n- Transaction URL: https://arbiscan.io/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Trade 100 GWEI for USDC on Polygon"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Traded 100 GWEI for USDC on Polygon network\n- Transaction URL: https://polygonscan.com/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Market buy ETH with 500 USDC on base"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Bought ETH with 500 USDC on base network\n- Transaction URL: https://basescan.io/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Sell 2.5 SOL for USDC on Solana mainnet"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Sold 2.5 SOL for USDC on Solana network\n- Transaction URL: https://solscan.io/tx/...\n- Status: Completed"
        }
      }
    ]
  ],
  similes: [
    "EXECUTE_TRADE",
    // Primary action name
    "SWAP_TOKENS",
    // For token swaps
    "CONVERT_CURRENCY",
    // For currency conversion
    "EXCHANGE_ASSETS",
    // For asset exchange
    "MARKET_BUY",
    // For buying assets
    "MARKET_SELL",
    // For selling assets
    "TRADE_CRYPTO"
    // Generic crypto trading
  ]
};
var tradePlugin = {
  name: "tradePlugin",
  description: "Enables asset trading using the Coinbase SDK.",
  actions: [executeTradeAction],
  providers: [tradeProvider]
};

// src/plugins/tokenContract.ts
import { Coinbase as Coinbase6, readContract } from "@coinbase/coinbase-sdk";
import {
  elizaLogger as elizaLogger5,
  composeContext as composeContext4,
  generateObject as generateObject4,
  ModelClass as ModelClass4
} from "@elizaos/core";
import path4 from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import { createArrayCsvWriter as createArrayCsvWriter4 } from "csv-writer";
import fs4 from "fs";

// src/constants.ts
var ABI = [
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "spender",
        type: "address",
        internalType: "address"
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "from",
        type: "address",
        internalType: "address"
      },
      {
        name: "to",
        type: "address",
        internalType: "address"
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "transferFrom",
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "uint8"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address"
      }
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address"
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "transfer",
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address"
      },
      {
        name: "spender",
        type: "address",
        internalType: "address"
      }
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        indexed: true,
        name: "owner",
        type: "address",
        internalType: "address"
      },
      {
        indexed: true,
        name: "spender",
        type: "address",
        internalType: "address"
      },
      {
        indexed: false,
        name: "value",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "Approval",
    type: "event",
    anonymous: false
  },
  {
    inputs: [
      {
        indexed: true,
        name: "from",
        type: "address",
        internalType: "address"
      },
      {
        indexed: true,
        name: "to",
        type: "address",
        internalType: "address"
      },
      {
        indexed: false,
        name: "value",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "Transfer",
    type: "event",
    anonymous: false
  }
];

// src/plugins/tokenContract.ts
var __filename4 = fileURLToPath4(import.meta.url);
var __dirname4 = path4.dirname(__filename4);
var baseDir4 = path4.resolve(__dirname4, "../../plugin-coinbase/src/plugins");
var contractsCsvFilePath = path4.join(baseDir4, "contracts.csv");
var serializeBigInt = (value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeBigInt(v)])
    );
  }
  return value;
};
var deployTokenContractAction = {
  name: "DEPLOY_TOKEN_CONTRACT",
  description: "Deploy an ERC20, ERC721, or ERC1155 token contract using the Coinbase SDK",
  validate: async (runtime, _message) => {
    elizaLogger5.info("Validating runtime for DEPLOY_TOKEN_CONTRACT...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger5.debug("Starting DEPLOY_TOKEN_CONTRACT handler...");
    try {
      Coinbase6.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      if (!fs4.existsSync(contractsCsvFilePath)) {
        const csvWriter2 = createArrayCsvWriter4({
          path: contractsCsvFilePath,
          header: [
            "Contract Type",
            "Name",
            "Symbol",
            "Network",
            "Contract Address",
            "Transaction URL",
            "Base URI",
            "Total Supply"
          ]
        });
        await csvWriter2.writeRecords([]);
      }
      const context = composeContext4({
        state,
        template: tokenContractTemplate
      });
      const contractDetails = await generateObject4({
        runtime,
        context,
        modelClass: ModelClass4.SMALL,
        schema: TokenContractSchema
      });
      elizaLogger5.info("Contract details:", contractDetails.object);
      if (!isTokenContractContent(contractDetails.object)) {
        callback(
          {
            text: "Invalid contract details. Please check the inputs."
          },
          []
        );
        return;
      }
      const {
        contractType,
        name,
        symbol,
        network,
        baseURI,
        totalSupply
      } = contractDetails.object;
      elizaLogger5.info("Contract details:", contractDetails.object);
      const wallet = await initializeWallet(runtime, network);
      let contract;
      let deploymentDetails;
      switch (contractType.toLowerCase()) {
        case "erc20":
          contract = await wallet.deployToken({
            name,
            symbol,
            totalSupply: totalSupply || 1e6
          });
          deploymentDetails = {
            contractType: "ERC20",
            totalSupply,
            baseURI: "N/A"
          };
          break;
        case "erc721":
          contract = await wallet.deployNFT({
            name,
            symbol,
            baseURI: baseURI || ""
          });
          deploymentDetails = {
            contractType: "ERC721",
            totalSupply: "N/A",
            baseURI
          };
          break;
        default:
          throw new Error(
            `Unsupported contract type: ${contractType}`
          );
      }
      await contract.wait();
      elizaLogger5.info("Deployment details:", deploymentDetails);
      elizaLogger5.info("Contract deployed successfully:", contract);
      const csvWriter = createArrayCsvWriter4({
        path: contractsCsvFilePath,
        header: [
          "Contract Type",
          "Name",
          "Symbol",
          "Network",
          "Contract Address",
          "Transaction URL",
          "Base URI",
          "Total Supply"
        ],
        append: true
      });
      const transaction = contract.getTransaction()?.getTransactionLink() || "";
      const contractAddress = contract.getContractAddress();
      await csvWriter.writeRecords([
        [
          deploymentDetails.contractType,
          name,
          symbol,
          network,
          contractAddress,
          transaction,
          deploymentDetails.baseURI,
          deploymentDetails.totalSupply || ""
        ]
      ]);
      callback(
        {
          text: `Token contract deployed successfully:
- Type: ${deploymentDetails.contractType}
- Name: ${name}
- Symbol: ${symbol}
- Network: ${network}
- Contract Address: ${contractAddress}
- Transaction URL: ${transaction}
${deploymentDetails.baseURI !== "N/A" ? `- Base URI: ${deploymentDetails.baseURI}` : ""}
${deploymentDetails.totalSupply !== "N/A" ? `- Total Supply: ${deploymentDetails.totalSupply}` : ""}

Contract deployment has been logged to the CSV file.`
        },
        []
      );
    } catch (error) {
      elizaLogger5.error("Error deploying token contract:", error);
      callback(
        {
          text: "Failed to deploy token contract. Please check the logs for more details."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Deploy an ERC721 token named 'MyNFT' with symbol 'MNFT' on base network with URI 'https://pbs.twimg.com/profile_images/1848823420336934913/oI0-xNGe_400x400.jpg'"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Token contract deployed successfully:
- Type: ERC20
- Name: MyToken
- Symbol: MTK
- Network: base
- Contract Address: 0x...
- Transaction URL: https://basescan.org/tx/...
- Total Supply: 1000000`
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "Deploy an ERC721 token named 'MyNFT' with symbol 'MNFT' on the base network"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Token contract deployed successfully:
- Type: ERC721
- Name: MyNFT
- Symbol: MNFT
- Network: base
- Contract Address: 0x...
- Transaction URL: https://basescan.org/tx/...
- URI: https://pbs.twimg.com/profile_images/1848823420336934913/oI0-xNGe_400x400.jpg`
        }
      }
    ]
  ],
  similes: ["DEPLOY_CONTRACT", "CREATE_TOKEN", "MINT_TOKEN", "CREATE_NFT"]
};
var invokeContractAction = {
  name: "INVOKE_CONTRACT",
  description: "Invoke a method on a deployed smart contract using the Coinbase SDK",
  validate: async (runtime, _message) => {
    elizaLogger5.info("Validating runtime for INVOKE_CONTRACT...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger5.debug("Starting INVOKE_CONTRACT handler...");
    try {
      Coinbase6.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const context = composeContext4({
        state,
        template: contractInvocationTemplate
      });
      const invocationDetails = await generateObject4({
        runtime,
        context,
        modelClass: ModelClass4.LARGE,
        schema: ContractInvocationSchema
      });
      elizaLogger5.info("Invocation details:", invocationDetails.object);
      if (!isContractInvocationContent(invocationDetails.object)) {
        callback(
          {
            text: "Invalid contract invocation details. Please check the inputs."
          },
          []
        );
        return;
      }
      const {
        contractAddress,
        method: method2,
        args,
        amount,
        assetId,
        networkId
      } = invocationDetails.object;
      const wallet = await initializeWallet(runtime, networkId);
      const invocationOptions = {
        contractAddress,
        method: method2,
        abi: ABI,
        args: {
          ...args,
          amount: args.amount || amount
          // Ensure amount is passed in args
        },
        networkId,
        assetId
      };
      elizaLogger5.info("Invocation options:", invocationOptions);
      const invocation = await wallet.invokeContract(invocationOptions);
      await invocation.wait();
      const csvWriter = createArrayCsvWriter4({
        path: contractsCsvFilePath,
        header: [
          "Contract Address",
          "Method",
          "Network",
          "Status",
          "Transaction URL",
          "Amount",
          "Asset ID"
        ],
        append: true
      });
      await csvWriter.writeRecords([
        [
          contractAddress,
          method2,
          networkId,
          invocation.getStatus(),
          invocation.getTransactionLink() || "",
          amount || "",
          assetId || ""
        ]
      ]);
      callback(
        {
          text: `Contract method invoked successfully:
- Contract Address: ${contractAddress}
- Method: ${method2}
- Network: ${networkId}
- Status: ${invocation.getStatus()}
- Transaction URL: ${invocation.getTransactionLink() || "N/A"}
${amount ? `- Amount: ${amount}` : ""}
${assetId ? `- Asset ID: ${assetId}` : ""}

Contract invocation has been logged to the CSV file.`
        },
        []
      );
    } catch (error) {
      elizaLogger5.error("Error invoking contract method:", error);
      callback(
        {
          text: "Failed to invoke contract method. Please check the logs for more details."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Call the 'transfer' method on my ERC20 token contract at 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 with amount 100 to recipient 0xbcF7C64B880FA89a015970dC104E848d485f99A3"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Contract method invoked successfully:
- Contract Address: 0x123...
- Method: transfer
- Network: base
- Status: SUCCESS
- Transaction URL: https://basescan.org/tx/...
- Amount: 100
- Asset ID: wei

Contract invocation has been logged to the CSV file.`
        }
      }
    ]
  ],
  similes: ["CALL_CONTRACT", "EXECUTE_CONTRACT", "INTERACT_WITH_CONTRACT"]
};
var readContractAction = {
  name: "READ_CONTRACT",
  description: "Read data from a deployed smart contract using the Coinbase SDK",
  validate: async (runtime, _message) => {
    elizaLogger5.info("Validating runtime for READ_CONTRACT...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger5.debug("Starting READ_CONTRACT handler...");
    try {
      Coinbase6.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const context = composeContext4({
        state,
        template: readContractTemplate
      });
      const readDetails = await generateObject4({
        runtime,
        context,
        modelClass: ModelClass4.SMALL,
        schema: ReadContractSchema
      });
      if (!isReadContractContent(readDetails.object)) {
        callback(
          {
            text: "Invalid contract read details. Please check the inputs."
          },
          []
        );
        return;
      }
      const { contractAddress, method: method2, args, networkId, abi } = readDetails.object;
      elizaLogger5.info("Reading contract:", {
        contractAddress,
        method: method2,
        args,
        networkId,
        abi
      });
      const result = await readContract({
        networkId,
        contractAddress,
        method: method2,
        args,
        abi: ABI
      });
      const serializedResult = serializeBigInt(result);
      elizaLogger5.info("Contract read result:", serializedResult);
      callback(
        {
          text: `Contract read successful:
- Contract Address: ${contractAddress}
- Method: ${method2}
- Network: ${networkId}
- Result: ${JSON.stringify(serializedResult, null, 2)}`
        },
        []
      );
    } catch (error) {
      elizaLogger5.error("Error reading contract:", error);
      callback(
        {
          text: `Failed to read contract: ${error instanceof Error ? error.message : "Unknown error"}`
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Read the balance of address 0xbcF7C64B880FA89a015970dC104E848d485f99A3 from the ERC20 contract at 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 on eth"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Contract read successful:
- Contract Address: 0x37f2131ebbc8f97717edc3456879ef56b9f4b97b
- Method: balanceOf
- Network: eth
- Result: "1000000"`
        }
      }
    ]
  ],
  similes: ["READ_CONTRACT", "GET_CONTRACT_DATA", "QUERY_CONTRACT"]
};
var tokenContractPlugin = {
  name: "tokenContract",
  description: "Enables deployment, invocation, and reading of ERC20, ERC721, and ERC1155 token contracts using the Coinbase SDK",
  actions: [
    deployTokenContractAction,
    invokeContractAction,
    readContractAction
  ]
};

// src/plugins/webhooks.ts
import { Coinbase as Coinbase7, Webhook } from "@coinbase/coinbase-sdk";
import {
  elizaLogger as elizaLogger6,
  composeContext as composeContext5,
  generateObject as generateObject5,
  ModelClass as ModelClass5
} from "@elizaos/core";
var webhookProvider = {
  get: async (runtime, _message) => {
    elizaLogger6.debug("Starting webhookProvider.get function");
    try {
      Coinbase7.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const resp = await Webhook.list();
      elizaLogger6.info("Listing all webhooks:", resp.data);
      return {
        webhooks: resp.data.map((webhook) => ({
          id: webhook.getId(),
          networkId: webhook.getNetworkId(),
          eventType: webhook.getEventType(),
          eventFilters: webhook.getEventFilters(),
          eventTypeFilter: webhook.getEventTypeFilter(),
          notificationURI: webhook.getNotificationURI()
        }))
      };
    } catch (error) {
      elizaLogger6.error("Error in webhookProvider:", error);
      return [];
    }
  }
};
var createWebhookAction = {
  name: "CREATE_WEBHOOK",
  description: "Create a new webhook using the Coinbase SDK.",
  validate: async (runtime, _message) => {
    elizaLogger6.info("Validating runtime for CREATE_WEBHOOK...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY) && !!(runtime.character.settings.secrets?.COINBASE_NOTIFICATION_URI || process.env.COINBASE_NOTIFICATION_URI);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger6.debug("Starting CREATE_WEBHOOK handler...");
    try {
      Coinbase7.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const context = composeContext5({
        state,
        template: webhookTemplate
      });
      const webhookDetails = await generateObject5({
        runtime,
        context,
        modelClass: ModelClass5.LARGE,
        schema: WebhookSchema
      });
      if (!isWebhookContent(webhookDetails.object)) {
        callback(
          {
            text: "Invalid webhook details. Ensure network, URL, event type, and contract address are correctly specified."
          },
          []
        );
        return;
      }
      const { networkId, eventType, eventFilters, eventTypeFilter } = webhookDetails.object;
      const notificationUri = runtime.getSetting("COINBASE_NOTIFICATION_URI") ?? process.env.COINBASE_NOTIFICATION_URI;
      if (!notificationUri) {
        callback(
          {
            text: "Notification URI is not set in the environment variables."
          },
          []
        );
        return;
      }
      elizaLogger6.info("Creating webhook with details:", {
        networkId,
        notificationUri,
        eventType,
        eventTypeFilter,
        eventFilters
      });
      const webhook = await Webhook.create({
        networkId,
        notificationUri,
        eventType,
        eventFilters
      });
      elizaLogger6.info(
        "Webhook created successfully:",
        webhook.toString()
      );
      callback(
        {
          text: `Webhook created successfully: ${webhook.toString()}`
        },
        []
      );
      await appendWebhooksToCsv([webhook]);
      elizaLogger6.info("Webhook appended to CSV successfully");
    } catch (error) {
      elizaLogger6.error("Error during webhook creation:", error);
      callback(
        {
          text: "Failed to create the webhook. Please check the logs for more details."
        },
        []
      );
    }
  },
  similes: ["WEBHOOK", "NOTIFICATION", "EVENT", "TRIGGER", "LISTENER"],
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Create a webhook on base for address 0xbcF7C64B880FA89a015970dC104E848d485f99A3 on the event type: transfers"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Webhook created successfully: Webhook ID: {{webhookId}}, Network ID: {{networkId}}, Notification URI: {{notificationUri}}, Event Type: {{eventType}}`,
          action: "CREATE_WEBHOOK"
        }
      }
    ]
  ]
};
var webhookPlugin = {
  name: "webhookPlugin",
  description: "Manages webhooks using the Coinbase SDK.",
  actions: [createWebhookAction],
  providers: [webhookProvider]
};

// advanced-sdk-ts/src/jwt-generator.ts
import jwt from "jsonwebtoken";

// advanced-sdk-ts/src/constants.ts
var BASE_URL = "api.coinbase.com";
var API_PREFIX = "/api/v3/brokerage";
var ALGORITHM = "ES256";
var VERSION = "0.1.0";
var USER_AGENT = `coinbase-advanced-ts/${VERSION}`;
var JWT_ISSUER = "cdp";

// advanced-sdk-ts/src/jwt-generator.ts
import crypto2 from "crypto";
function generateToken(requestMethod, requestPath, apiKey, apiSecret) {
  const uri = `${requestMethod} ${BASE_URL}${requestPath}`;
  const payload = {
    iss: JWT_ISSUER,
    nbf: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 120,
    sub: apiKey,
    uri
  };
  const header = {
    alg: ALGORITHM,
    kid: apiKey,
    nonce: crypto2.randomBytes(16).toString("hex")
  };
  const options = {
    algorithm: ALGORITHM,
    header
  };
  return jwt.sign(payload, apiSecret, options);
}

// advanced-sdk-ts/src/rest/rest-base.ts
import fetch2, { Headers } from "node-fetch";

// advanced-sdk-ts/src/rest/errors.ts
var CoinbaseError = class extends Error {
  statusCode;
  response;
  constructor(message, statusCode, response) {
    super(message);
    this.name = "CoinbaseError";
    this.statusCode = statusCode;
    this.response = response;
  }
};
function handleException(response, responseText, reason) {
  let message;
  if (400 <= response.status && response.status <= 499 || 500 <= response.status && response.status <= 599) {
    if (response.status == 403 && responseText.includes('"error_details":"Missing required scopes"')) {
      message = `${response.status} Coinbase Error: Missing Required Scopes. Please verify your API keys include the necessary permissions.`;
    } else
      message = `${response.status} Coinbase Error: ${reason} ${responseText}`;
    throw new CoinbaseError(message, response.status, response);
  }
}

// advanced-sdk-ts/src/rest/rest-base.ts
var RESTBase = class {
  apiKey;
  apiSecret;
  constructor(key, secret) {
    if (!key || !secret) {
      console.log(
        "Could not authenticate. Only public endpoints accessible."
      );
    }
    this.apiKey = key;
    this.apiSecret = secret;
  }
  request(options) {
    const { method: method2, endpoint, isPublic } = options;
    let { queryParams, bodyParams } = options;
    queryParams = queryParams ? this.filterParams(queryParams) : {};
    if (bodyParams !== void 0)
      bodyParams = bodyParams ? this.filterParams(bodyParams) : {};
    return this.prepareRequest(
      method2,
      endpoint,
      queryParams,
      bodyParams,
      isPublic
    );
  }
  prepareRequest(httpMethod, urlPath, queryParams, bodyParams, isPublic) {
    const headers = this.setHeaders(httpMethod, urlPath, isPublic);
    const requestOptions = {
      method: httpMethod,
      headers,
      body: JSON.stringify(bodyParams)
    };
    const queryString = this.buildQueryString(queryParams);
    const url2 = `https://${BASE_URL}${urlPath}${queryString}`;
    return this.sendRequest(headers, requestOptions, url2);
  }
  async sendRequest(headers, requestOptions, url2) {
    const response = await fetch2(url2, requestOptions);
    const responseText = await response.text();
    handleException(response, responseText, response.statusText);
    return responseText;
  }
  setHeaders(httpMethod, urlPath, isPublic) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("User-Agent", USER_AGENT);
    if (this.apiKey !== void 0 && this.apiSecret !== void 0)
      headers.append(
        "Authorization",
        `Bearer ${generateToken(
          httpMethod,
          urlPath,
          this.apiKey,
          this.apiSecret
        )}`
      );
    else if (isPublic == void 0 || isPublic == false)
      throw new Error(
        "Attempting to access authenticated endpoint with invalid API_KEY or API_SECRET."
      );
    return headers;
  }
  filterParams(data) {
    const filteredParams = {};
    for (const key in data) {
      if (data[key] !== void 0) {
        filteredParams[key] = data[key];
      }
    }
    return filteredParams;
  }
  buildQueryString(queryParams) {
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return "";
    }
    const queryString = Object.entries(queryParams).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map(
          (item) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`
        );
      } else {
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
    }).join("&");
    return `?${queryString}`;
  }
};

// advanced-sdk-ts/src/rest/accounts.ts
function getAccount({ accountUuid }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/accounts/${accountUuid}`,
    isPublic: false
  });
}
function listAccounts(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/accounts`,
    queryParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/converts.ts
function createConvertQuote(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/convert/quote`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function getConvertTrade({ tradeId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/convert/trade/${tradeId}`,
    queryParams: requestParams,
    isPublic: false
  });
}
function commitConvertTrade({ tradeId, ...requestParams }) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/convert/trade/${tradeId}`,
    bodyParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/dataAPI.ts
function getAPIKeyPermissions() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/key_permissions`,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/fees.ts
function getTransactionSummary(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/transaction_summary`,
    queryParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/futures.ts
function getFuturesBalanceSummary() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/balance_summary`,
    isPublic: false
  });
}
function getIntradayMarginSetting() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/intraday/margin_setting`,
    isPublic: false
  });
}
function setIntradayMarginSetting(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/cfm/intraday/margin_setting`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function getCurrentMarginWindow(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/intraday/current_margin_window`,
    queryParams: requestParams,
    isPublic: false
  });
}
function listFuturesPositions() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/positions`,
    isPublic: false
  });
}
function getFuturesPosition({ productId }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/positions/${productId}`,
    isPublic: false
  });
}
function scheduleFuturesSweep(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/cfm/sweeps/schedule`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function listFuturesSweeps() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/sweeps`,
    isPublic: false
  });
}
function cancelPendingFuturesSweep() {
  return this.request({
    method: "DELETE" /* DELETE */,
    endpoint: `${API_PREFIX}/cfm/sweeps`,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/orders.ts
function createOrder(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function cancelOrders(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/batch_cancel`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function editOrder(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/edit`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function editOrderPreview(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/edit_preview`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function listOrders(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/orders/historical/batch`,
    queryParams: requestParams,
    isPublic: false
  });
}
function listFills(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/orders/historical/fills`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getOrder({ orderId }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/orders/historical/${orderId}`,
    isPublic: false
  });
}
function previewOrder(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/preview`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function closePosition(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/close_position`,
    queryParams: void 0,
    bodyParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/payments.ts
function listPaymentMethods() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/payment_methods`,
    isPublic: false
  });
}
function getPaymentMethod({ paymentMethodId }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/payment_methods/${paymentMethodId}`,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/perpetuals.ts
function allocatePortfolio(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/intx/allocate`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function getPerpetualsPortfolioSummary({ portfolioUuid }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/intx/portfolio/${portfolioUuid}`,
    isPublic: false
  });
}
function listPerpetualsPositions({ portfolioUuid }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/intx/positions/${portfolioUuid}`,
    isPublic: false
  });
}
function getPerpertualsPosition({ portfolioUuid, symbol }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/intx/positions/${portfolioUuid}/${symbol}`,
    isPublic: false
  });
}
function getPortfolioBalances({ portfolioUuid }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/intx/balances/${portfolioUuid}`,
    isPublic: false
  });
}
function optInOutMultiAssetCollateral(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/intx/multi_asset_collateral`,
    bodyParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/portfolios.ts
function listPortfolios(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/portfolios`,
    queryParams: requestParams,
    isPublic: false
  });
}
function createPortfolio(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/portfolios`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function movePortfolioFunds(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/portfolios/move_funds`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function getPortfolioBreakdown({ portfolioUuid, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/portfolios/${portfolioUuid}`,
    queryParams: requestParams,
    isPublic: false
  });
}
function deletePortfolio({ portfolioUuid }) {
  return this.request({
    method: "DELETE" /* DELETE */,
    endpoint: `${API_PREFIX}/portfolios/${portfolioUuid}`,
    isPublic: false
  });
}
function editPortfolio({ portfolioUuid, ...requestParams }) {
  return this.request({
    method: "PUT" /* PUT */,
    endpoint: `${API_PREFIX}/portfolios/${portfolioUuid}`,
    bodyParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/products.ts
function getBestBidAsk(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/best_bid_ask`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getProductBook(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/product_book`,
    queryParams: requestParams,
    isPublic: false
  });
}
function listProducts(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getProduct({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products/${productId}`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getProductCandles({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products/${productId}/candles`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getMarketTrades({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products/${productId}/ticker`,
    queryParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/public.ts
function getServerTime() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/time`,
    isPublic: true
  });
}
function getPublicProductBook(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/market/product_book`,
    queryParams: requestParams,
    isPublic: true
  });
}
function listPublicProducts(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/market/products`,
    queryParams: requestParams,
    isPublic: true
  });
}
function getPublicProduct({ productId }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/market/products/${productId}`,
    isPublic: true
  });
}
function getPublicProductCandles({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/market/products/${productId}/candles`,
    queryParams: requestParams,
    isPublic: true
  });
}
function getPublicMarketTrades({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products/${productId}/ticker`,
    queryParams: requestParams,
    isPublic: true
  });
}

// advanced-sdk-ts/src/rest/index.ts
var RESTClient = class extends RESTBase {
  constructor(key, secret) {
    super(key, secret);
  }
  // =============== ACCOUNTS endpoints ===============
  getAccount = getAccount.bind(this);
  listAccounts = listAccounts.bind(this);
  // =============== CONVERTS endpoints ===============
  createConvertQuote = createConvertQuote.bind(this);
  commitConvertTrade = commitConvertTrade.bind(this);
  getConvertTrade = getConvertTrade.bind(this);
  // =============== DATA API endpoints ===============
  getAPIKeyPermissions = getAPIKeyPermissions.bind(this);
  // =============== FEES endpoints ===============
  getTransactionSummary = getTransactionSummary.bind(this);
  // =============== FUTURES endpoints ===============
  getFuturesBalanceSummary = getFuturesBalanceSummary.bind(this);
  getIntradayMarginSetting = getIntradayMarginSetting.bind(this);
  setIntradayMarginSetting = setIntradayMarginSetting.bind(this);
  getCurrentMarginWindow = getCurrentMarginWindow.bind(this);
  listFuturesPositions = listFuturesPositions.bind(this);
  getFuturesPosition = getFuturesPosition.bind(this);
  scheduleFuturesSweep = scheduleFuturesSweep.bind(this);
  listFuturesSweeps = listFuturesSweeps.bind(this);
  cancelPendingFuturesSweep = cancelPendingFuturesSweep.bind(this);
  // =============== ORDERS endpoints ===============
  createOrder = createOrder.bind(this);
  cancelOrders = cancelOrders.bind(this);
  editOrder = editOrder.bind(this);
  editOrderPreview = editOrderPreview.bind(this);
  listOrders = listOrders.bind(this);
  listFills = listFills.bind(this);
  getOrder = getOrder.bind(this);
  previewOrder = previewOrder.bind(this);
  closePosition = closePosition.bind(this);
  // =============== PAYMENTS endpoints ===============
  listPaymentMethods = listPaymentMethods.bind(this);
  getPaymentMethod = getPaymentMethod.bind(this);
  // =============== PERPETUALS endpoints ===============
  allocatePortfolio = allocatePortfolio.bind(this);
  getPerpetualsPortfolioSummary = getPerpetualsPortfolioSummary.bind(this);
  listPerpetualsPositions = listPerpetualsPositions.bind(this);
  getPerpetualsPosition = getPerpertualsPosition.bind(this);
  getPortfolioBalances = getPortfolioBalances.bind(this);
  optInOutMultiAssetCollateral = optInOutMultiAssetCollateral.bind(this);
  // =============== PORTFOLIOS endpoints ===============
  listPortfolios = listPortfolios.bind(this);
  createPortfolio = createPortfolio.bind(this);
  deletePortfolio = deletePortfolio.bind(this);
  editPortfolio = editPortfolio.bind(this);
  movePortfolioFunds = movePortfolioFunds.bind(this);
  getPortfolioBreakdown = getPortfolioBreakdown.bind(this);
  // =============== PRODUCTS endpoints ===============
  getBestBidAsk = getBestBidAsk.bind(this);
  getProductBook = getProductBook.bind(this);
  listProducts = listProducts.bind(this);
  getProduct = getProduct.bind(this);
  getProductCandles = getProductCandles.bind(this);
  getMarketTrades = getMarketTrades.bind(this);
  // =============== PUBLIC endpoints ===============
  getServerTime = getServerTime.bind(this);
  getPublicProductBook = getPublicProductBook.bind(this);
  listPublicProducts = listPublicProducts.bind(this);
  getPublicProduct = getPublicProduct.bind(this);
  getPublicProductCandles = getPublicProductCandles.bind(this);
  getPublicMarketTrades = getPublicMarketTrades.bind(this);
};

// src/plugins/advancedTrade.ts
import {
  elizaLogger as elizaLogger7,
  composeContext as composeContext6,
  generateObject as generateObject6,
  ModelClass as ModelClass6
} from "@elizaos/core";
import { readFile as readFile3 } from "fs/promises";
import { parse as parse3 } from "csv-parse/sync";
import path5 from "path";
import { fileURLToPath as fileURLToPath5 } from "url";
import fs5 from "fs";
import { createArrayCsvWriter as createArrayCsvWriter5 } from "csv-writer";
var __filename5 = fileURLToPath5(import.meta.url);
var __dirname5 = path5.dirname(__filename5);
var baseDir5 = path5.resolve(__dirname5, "../../plugin-coinbase/src/plugins");
var tradeCsvFilePath3 = path5.join(baseDir5, "advanced_trades.csv");
var tradeProvider2 = {
  get: async (runtime, _message) => {
    elizaLogger7.debug("Starting tradeProvider function");
    try {
      const client = new RESTClient(
        runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      );
      let accounts, products;
      try {
        accounts = await client.listAccounts({});
      } catch (error) {
        elizaLogger7.error("Error fetching accounts:", error);
        return [];
      }
      try {
        products = await client.listProducts({});
      } catch (error) {
        elizaLogger7.error("Error fetching products:", error);
        return [];
      }
      if (!fs5.existsSync(tradeCsvFilePath3)) {
        const csvWriter = createArrayCsvWriter5({
          path: tradeCsvFilePath3,
          header: [
            "Order ID",
            "Success",
            "Order Configuration",
            "Response"
          ]
        });
        await csvWriter.writeRecords([]);
      }
      let csvData, records;
      try {
        csvData = await readFile3(tradeCsvFilePath3, "utf-8");
      } catch (error) {
        elizaLogger7.error("Error reading CSV file:", error);
        return [];
      }
      try {
        records = parse3(csvData, {
          columns: true,
          skip_empty_lines: true
        });
      } catch (error) {
        elizaLogger7.error("Error parsing CSV data:", error);
        return [];
      }
      return {
        accounts: accounts.accounts,
        products: products.products,
        trades: records
      };
    } catch (error) {
      elizaLogger7.error("Error in tradeProvider:", error);
      return [];
    }
  }
};
async function hasEnoughBalance(client, currency, amount, side) {
  elizaLogger7.debug("Starting hasEnoughBalance function");
  try {
    const response = await client.listAccounts({});
    const accounts = JSON.parse(response);
    elizaLogger7.info("Accounts:", accounts);
    const checkCurrency = side === "BUY" ? "USD" : currency;
    elizaLogger7.info(
      `Checking balance for ${side} order of ${amount} ${checkCurrency}`
    );
    const account = accounts?.accounts.find(
      (acc) => acc.currency === checkCurrency && (checkCurrency === "USD" ? acc.type === "ACCOUNT_TYPE_FIAT" : acc.type === "ACCOUNT_TYPE_CRYPTO")
    );
    if (!account) {
      elizaLogger7.error(`No ${checkCurrency} account found`);
      return false;
    }
    const available = Number.parseFloat(account.available_balance.value);
    const requiredAmount = side === "BUY" ? amount * 1.01 : amount;
    elizaLogger7.info(
      `Required amount (including buffer): ${requiredAmount} ${checkCurrency}`
    );
    const hasBalance = available >= requiredAmount;
    elizaLogger7.info(`Has sufficient balance: ${hasBalance}`);
    return hasBalance;
  } catch (error) {
    elizaLogger7.error("Balance check failed with error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      currency,
      amount,
      side
    });
    return false;
  }
}
var executeAdvancedTradeAction = {
  name: "EXECUTE_ADVANCED_TRADE",
  description: "Execute a trade using Coinbase Advanced Trading API",
  validate: async (runtime) => {
    return !!(runtime.getSetting("COINBASE_API_KEY") || process.env.COINBASE_API_KEY) && !!(runtime.getSetting("COINBASE_PRIVATE_KEY") || process.env.COINBASE_PRIVATE_KEY);
  },
  similes: [
    "EXECUTE_ADVANCED_TRADE",
    "ADVANCED_MARKET_ORDER",
    "ADVANCED_LIMIT_ORDER",
    "COINBASE_PRO_TRADE",
    "PROFESSIONAL_TRADE"
  ],
  handler: async (runtime, _message, state, _options, callback) => {
    let client;
    elizaLogger7.debug("Starting advanced trade client initialization");
    try {
      client = new RESTClient(
        runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      );
      elizaLogger7.info("Advanced trade client initialized");
    } catch (error) {
      elizaLogger7.error("Client initialization failed:", error);
      callback(
        {
          text: "Failed to initialize trading client. Please check your API credentials."
        },
        []
      );
      return;
    }
    let tradeDetails;
    elizaLogger7.debug("Starting trade details generation");
    try {
      tradeDetails = await generateObject6({
        runtime,
        context: composeContext6({
          state,
          template: advancedTradeTemplate
        }),
        modelClass: ModelClass6.LARGE,
        schema: AdvancedTradeSchema
      });
      elizaLogger7.info("Trade details generated:", tradeDetails.object);
    } catch (error) {
      elizaLogger7.error("Trade details generation failed:", error);
      callback(
        {
          text: "Failed to generate trade details. Please provide valid trading parameters."
        },
        []
      );
      return;
    }
    if (!isAdvancedTradeContent(tradeDetails.object)) {
      elizaLogger7.error("Invalid trade content:", tradeDetails.object);
      callback(
        {
          text: "Invalid trade details. Please check your input parameters."
        },
        []
      );
      return;
    }
    const { productId, amount, side, orderType, limitPrice } = tradeDetails.object;
    let orderConfiguration;
    elizaLogger7.debug("Starting order configuration");
    try {
      if (orderType === "MARKET") {
        orderConfiguration = side === "BUY" ? {
          market_market_ioc: {
            quote_size: amount.toString()
          }
        } : {
          market_market_ioc: {
            base_size: amount.toString()
          }
        };
      } else {
        if (!limitPrice) {
          throw new Error("Limit price is required for limit orders");
        }
        orderConfiguration = {
          limit_limit_gtc: {
            baseSize: amount.toString(),
            limitPrice: limitPrice.toString(),
            postOnly: false
          }
        };
      }
      elizaLogger7.info(
        "Order configuration created:",
        orderConfiguration
      );
    } catch (error) {
      elizaLogger7.error("Order configuration failed:", error);
      callback(
        {
          text: error instanceof Error ? error.message : "Failed to configure order parameters."
        },
        []
      );
      return;
    }
    let order;
    try {
      elizaLogger7.debug("Executing the trade");
      if (!await hasEnoughBalance(
        client,
        productId.split("-")[0],
        amount,
        side
      )) {
        callback(
          {
            text: `Insufficient ${side === "BUY" ? "USD" : productId.split("-")[0]} balance to execute this trade`
          },
          []
        );
        return;
      }
      order = await client.createOrder({
        clientOrderId: crypto.randomUUID(),
        productId,
        side: side === "BUY" ? "BUY" /* BUY */ : "SELL" /* SELL */,
        orderConfiguration
      });
      elizaLogger7.info("Trade executed successfully:", order);
    } catch (error) {
      elizaLogger7.error("Trade execution failed:", error?.message);
      callback(
        {
          text: `Failed to execute trade: ${error instanceof Error ? error.message : "Unknown error occurred"}`
        },
        []
      );
      return;
    }
    try {
      elizaLogger7.info("Trade logged to CSV");
    } catch (csvError) {
      elizaLogger7.warn("Failed to log trade to CSV:", csvError);
    }
    callback(
      {
        text: `Advanced Trade executed successfully:
- Product: ${productId}
- Type: ${orderType} Order
- Side: ${side}
- Amount: ${amount}
- ${orderType === "LIMIT" ? `- Limit Price: ${limitPrice}
` : ""}- Order ID: ${order.order_id}
- Status: ${order.success}
- Order Id:  ${order.order_id}
- Response: ${JSON.stringify(order.response)}
- Order Configuration: ${JSON.stringify(order.order_configuration)}`
      },
      []
    );
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Place an advanced market order to buy $1 worth of BTC"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Advanced Trade executed successfully:
- Product: BTC-USD
- Type: Market Order
- Side: BUY
- Amount: 1000
- Order ID: CB-ADV-12345
- Success: true
- Response: {"success_response":{}}
- Order Configuration: {"market_market_ioc":{"quote_size":"1000"}}`
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Set a limit order to sell 0.5 ETH at $2000" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Advanced Trade executed successfully:
- Product: ETH-USD
- Type: Limit Order
- Side: SELL
- Amount: 0.5
- Limit Price: 2000
- Order ID: CB-ADV-67890
- Success: true
- Response: {"success_response":{}}
- Order Configuration: {"limit_limit_gtc":{"baseSize":"0.5","limitPrice":"2000","postOnly":false}}`
        }
      }
    ]
  ]
};
var advancedTradePlugin = {
  name: "advancedTradePlugin",
  description: "Enables advanced trading using Coinbase Advanced Trading API",
  actions: [executeAdvancedTradeAction],
  providers: [tradeProvider2]
};

// src/index.ts
var plugins = {
  coinbaseMassPaymentsPlugin,
  coinbaseCommercePlugin,
  tradePlugin,
  tokenContractPlugin,
  webhookPlugin,
  advancedTradePlugin
};
var mergedPlugins = {
  name: "coinbase",
  description: "Coinbase plugin. Enables various functionalities using the Coinbase SDK.",
  actions: Object.values(plugins).map((plugin) => plugin.actions).filter(Boolean).flat(),
  providers: Object.values(plugins).map((plugin) => plugin.providers).filter(Boolean).flat(),
  evaluators: Object.values(plugins).map((plugin) => plugin.evaluators).filter(Boolean).flat(),
  services: Object.values(plugins).map((plugin) => plugin.services).filter(Boolean).flat()
};
var index_default = mergedPlugins;
export {
  index_default as default,
  mergedPlugins,
  plugins
};
//# sourceMappingURL=index.js.map