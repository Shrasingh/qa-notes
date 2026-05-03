// create a file src/utils/validateItemPricing.js
//This file is reusable everywhere.


export function validateItemPricing(items, packageSummary = {}) {
  const invalidItems = [];

  items.forEach((item) => {
    const sale = Number(item.salePrice) || 0;
    const extended = Number(item.extendedPrice) || 0;

    const packageApplied =
      item.packageKey &&
      packageSummary?.[item.packageKey]?.applied === true;

    const isValid =
      sale > 0 &&
      (extended > 0 || packageApplied);

    if (!isValid) {
      invalidItems.push(item.sku || item.itemId || `Row-${item.id}`);
    }
  });

  return {
    isValid: invalidItems.length === 0,
    invalidItems,
  };
}


//STEP 2 — APPLY CHECK IN LEFT PANEL (Pickup / Delivery FORMCARD,PAYMENT & SUMMARY FORMCARD)
