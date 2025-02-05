import * as _elizaos_core from '@elizaos/core';
import { Provider, Action, Plugin } from '@elizaos/core';

declare const massPayoutProvider: Provider;
declare const sendMassPayoutAction: Action;
declare const coinbaseMassPaymentsPlugin: Plugin;

interface ChargeRequest {
    name: string;
    description: string;
    pricing_type: string;
    local_price: {
        amount: string;
        currency: string;
    };
}
declare function createCharge(apiKey: string, params: ChargeRequest): Promise<any>;
declare function getAllCharges(apiKey: string): Promise<any>;
declare function getChargeDetails(apiKey: string, chargeId: string): Promise<any>;
declare const createCoinbaseChargeAction: Action;
declare const getAllChargesAction: Action;
declare const getChargeDetailsAction: Action;
declare const chargeProvider: Provider;
declare const coinbaseCommercePlugin: Plugin;

declare const tradeProvider: Provider;
declare const executeTradeAction: Action;
declare const tradePlugin: Plugin;

declare const deployTokenContractAction: Action;
declare const invokeContractAction: Action;
declare const readContractAction: Action;
declare const tokenContractPlugin: Plugin;

declare const webhookProvider: Provider;
declare const createWebhookAction: Action;
declare const webhookPlugin: Plugin;

declare function appendTradeToCsv(tradeResult: any): Promise<void>;
declare const executeAdvancedTradeAction: Action;
declare const advancedTradePlugin: Plugin;

declare const plugins: {
    coinbaseMassPaymentsPlugin: _elizaos_core.Plugin;
    coinbaseCommercePlugin: _elizaos_core.Plugin;
    tradePlugin: _elizaos_core.Plugin;
    tokenContractPlugin: _elizaos_core.Plugin;
    webhookPlugin: _elizaos_core.Plugin;
    advancedTradePlugin: _elizaos_core.Plugin;
};

export { advancedTradePlugin, appendTradeToCsv, chargeProvider, coinbaseCommercePlugin, coinbaseMassPaymentsPlugin, createCharge, createCoinbaseChargeAction, createWebhookAction, deployTokenContractAction, executeAdvancedTradeAction, executeTradeAction, getAllCharges, getAllChargesAction, getChargeDetails, getChargeDetailsAction, invokeContractAction, massPayoutProvider, plugins, readContractAction, sendMassPayoutAction, tokenContractPlugin, tradePlugin, tradeProvider, webhookPlugin, webhookProvider };
