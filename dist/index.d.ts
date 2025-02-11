import * as _elizaos_core from '@elizaos/core';

declare const plugins: {
    coinbaseMassPaymentsPlugin: _elizaos_core.Plugin;
    coinbaseCommercePlugin: _elizaos_core.Plugin;
    tradePlugin: _elizaos_core.Plugin;
    tokenContractPlugin: _elizaos_core.Plugin;
    webhookPlugin: _elizaos_core.Plugin;
    advancedTradePlugin: _elizaos_core.Plugin;
};
declare const mergedPlugins: {
    actions: any[];
    providers: any[];
    evaluators: any[];
    services: any[];
};

export { mergedPlugins as default, plugins };
