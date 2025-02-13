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
    name: string;
    description: string;
    actions: _elizaos_core.Action[];
    providers: _elizaos_core.Provider[];
    evaluators: _elizaos_core.Evaluator[];
    services: _elizaos_core.Service[];
};

export { mergedPlugins as default, mergedPlugins, plugins };
