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
    coinbaseMassPaymentsPlugin: any;
    coinbaseCommercePlugin: any;
    tradePlugin: any;
    tokenContractPlugin: any;
    webhookPlugin: any;
    advancedTradePlugin: any;
};
declare const mergedPlugins: {
    actions: any[];
    providers: any[];
    evaluators: any[];
    services: any[];
};

export { advancedTradePlugin, appendTradeToCsv, chargeProvider, coinbaseCommercePlugin, coinbaseMassPaymentsPlugin, createCharge, createCoinbaseChargeAction, createWebhookAction, mergedPlugins as default, deployTokenContractAction, executeAdvancedTradeAction, executeTradeAction, getAllCharges, getAllChargesAction, getChargeDetails, getChargeDetailsAction, invokeContractAction, massPayoutProvider, plugins, readContractAction, sendMassPayoutAction, tokenContractPlugin, tradePlugin, tradeProvider, webhookPlugin, webhookProvider };
