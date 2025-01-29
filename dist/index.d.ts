declare const plugins: {
    coinbaseMassPaymentsPlugin: Plugin;
    coinbaseCommercePlugin: Plugin;
    tradePlugin: Plugin;
    tokenContractPlugin: Plugin;
    webhookPlugin: Plugin;
    advancedTradePlugin: Plugin;
};
declare const mergedPlugins: {
    actions: any[];
    providers: any[];
    evaluators: any[];
    services: any[];
};

export { mergedPlugins as default, plugins };
