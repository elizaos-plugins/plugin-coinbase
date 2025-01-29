import { coinbaseMassPaymentsPlugin } from "./plugins/massPayments";
import { coinbaseCommercePlugin } from "./plugins/commerce";
import { tradePlugin } from "./plugins/trade";
import { tokenContractPlugin } from "./plugins/tokenContract";
import { webhookPlugin } from "./plugins/webhooks";
import { advancedTradePlugin } from "./plugins/advancedTrade";

export const plugins = {
    coinbaseMassPaymentsPlugin,
    coinbaseCommercePlugin,
    tradePlugin,
    tokenContractPlugin,
    webhookPlugin,
    advancedTradePlugin,
};

function mergePlugins(base: object, plugins: any[]) {
    return {
        ...base,
        actions: [...plugins.map(plugin => plugin.actions)],
        providers: [...plugins.map(plugin => plugin.providers)],
        evaluators: [...plugins.map(plugin => plugin.evaluators)],
        services: [...plugins.map(plugin => plugin.services)],
    };
}
const mergedPlugins = mergePlugins({
    name: 'coinbase',
    description: 'Coinbase plugin. Enables various functionalities using the Coinbase SDK.',
}, Object.values(plugins));
export default mergedPlugins;