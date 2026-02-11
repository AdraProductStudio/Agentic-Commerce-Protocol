export function formatCurrency(currency) {
    switch (currency) {
        case "USD":
            return "$";
        case "INR":
            return "₹";
        case "EUR":
            return "€";
        case "GBP":
            return "£";
        default:
            return currency + " ";
    }
}