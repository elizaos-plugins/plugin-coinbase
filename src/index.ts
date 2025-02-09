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