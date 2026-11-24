import { VAT_EXEMPTION_CODE, type FacturXInvoice, type Party } from './FacturXData'

/*
 * The XML of a Factur-X invoice: UN/CEFACT Cross Industry Invoice (CII D16B), profile EN 16931 (Factur-X "EN 16931",
 * ex-COMFORT), with the French rules (XP Z12-012): business process (BT-23), SIREN (scheme 0002), electronic address
 * (scheme 0225), notes PMT / PMD / AAB, BAR B2C for a consumer.
 *   const xml = FacturXXml.build(data)      data: FacturXData.of(doc)
 * The order of the elements is the one of the XSD: a different order is refused by the validators.
 */
export const FACTURX_PROFILE = { guideline: 'urn:cen.eu:en16931:2017', level: 'EN 16931' }

const escape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const amount = (value: number) => (Math.round(value * 100) / 100).toFixed(2)
const quantity = (value: number) => String(Math.round(value * 10000) / 10000)
const date = (iso: string) => `<udt:DateTimeString format="102">${String(iso).slice(0, 10).replace(/-/g, '')}</udt:DateTimeString>`
// An element only when its value is not empty
const optional = (value: unknown, xml: string) => value ? xml : ''

const party = (tag: string, p: Party, isSeller: boolean) => {
    const a = p.address
    // Electronic address (BT-34 / BT-49): the SIREN (scheme 0225); a consumer: his email if any (scheme EM)
    const uri = p.einvoiceAddress ? `<ram:URIID schemeID="0225">${escape(p.einvoiceAddress)}</ram:URIID>` : p.email ? `<ram:URIID schemeID="EM">${escape(p.email)}</ram:URIID>` : ''
    // Seller: its VAT number (VA), or without one its SIRET as tax registration (FC): rule BR-E-02 of an exempt invoice
    const tax = p.vatNumber ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escape(p.vatNumber)}</ram:ID></ram:SpecifiedTaxRegistration>`
        : isSeller && p.siret ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${escape(p.siret)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''
    return `<ram:${tag}>
        <ram:Name>${escape(p.name)}</ram:Name>
        ${optional(p.siren, `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${escape(p.siren)}</ram:ID></ram:SpecifiedLegalOrganization>`)}
        <ram:PostalTradeAddress>
            ${optional(a.postalCode, `<ram:PostcodeCode>${escape(a.postalCode)}</ram:PostcodeCode>`)}
            ${optional(a.line, `<ram:LineOne>${escape(a.line)}</ram:LineOne>`)}
            ${optional(a.city, `<ram:CityName>${escape(a.city)}</ram:CityName>`)}
            <ram:CountryID>${escape(a.country || 'FR')}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${optional(uri, `<ram:URIUniversalCommunication>${uri}</ram:URIUniversalCommunication>`)}
        ${tax}
    </ram:${tag}>`
}

const tradeTax = (category: string, rate: number) =>
    `<ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${category}</ram:CategoryCode><ram:RateApplicablePercent>${amount(rate)}</ram:RateApplicablePercent>`

export const FacturXXml = {
    build(inv: FacturXInvoice) {
        const cur = escape(inv.currency)
        const lines = inv.lines.map(line => `
        <ram:IncludedSupplyChainTradeLineItem>
            <ram:AssociatedDocumentLineDocument><ram:LineID>${line.id}</ram:LineID></ram:AssociatedDocumentLineDocument>
            <ram:SpecifiedTradeProduct>
                <ram:Name>${escape(line.name)}</ram:Name>
                ${optional(line.details, `<ram:Description>${escape(line.details)}</ram:Description>`)}
            </ram:SpecifiedTradeProduct>
            <ram:SpecifiedLineTradeAgreement>
                <ram:NetPriceProductTradePrice><ram:ChargeAmount>${amount(line.price)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
            </ram:SpecifiedLineTradeAgreement>
            <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${line.unitCode}">${quantity(line.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
            <ram:SpecifiedLineTradeSettlement>
                <ram:ApplicableTradeTax>${tradeTax(line.category, line.rate)}</ram:ApplicableTradeTax>
                <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amount(line.total)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
            </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`).join('')

        const taxes = inv.taxes.map(group => `
            <ram:ApplicableTradeTax>
                <ram:CalculatedAmount>${amount(group.tax)}</ram:CalculatedAmount>
                <ram:TypeCode>VAT</ram:TypeCode>
                ${optional(group.reason, `<ram:ExemptionReason>${escape(group.reason)}</ram:ExemptionReason>`)}
                <ram:BasisAmount>${amount(group.basis)}</ram:BasisAmount>
                <ram:CategoryCode>${group.category}</ram:CategoryCode>
                ${optional(group.category === 'E', `<ram:ExemptionReasonCode>${VAT_EXEMPTION_CODE}</ram:ExemptionReasonCode>`)}
                <ram:RateApplicablePercent>${amount(group.rate)}</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>`).join('')

        // The discount of the document: one allowance per VAT category
        const allowances = inv.taxes.filter(group => group.allowance > 0).map(group => `
            <ram:SpecifiedTradeAllowanceCharge>
                <ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>
                <ram:ActualAmount>${amount(group.allowance)}</ram:ActualAmount>
                <ram:Reason>Remise</ram:Reason>
                <ram:CategoryTradeTax>${tradeTax(group.category, group.rate)}</ram:CategoryTradeTax>
            </ram:SpecifiedTradeAllowanceCharge>`).join('')

        const account = inv.paymentMeans === '58' ? `
                <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${escape(inv.iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>
                ${optional(inv.bic, `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${escape(inv.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>`)}` : ''
        const t = inv.totals

        return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
    <rsm:ExchangedDocumentContext>
        <ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${inv.businessProcess}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>
        <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${FACTURX_PROFILE.guideline}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
    </rsm:ExchangedDocumentContext>
    <rsm:ExchangedDocument>
        <ram:ID>${escape(inv.number)}</ram:ID>
        <ram:TypeCode>${inv.typeCode}</ram:TypeCode>
        <ram:IssueDateTime>${date(inv.issueDate)}</ram:IssueDateTime>
        ${inv.notes.map(note => `<ram:IncludedNote><ram:Content>${escape(note.text)}</ram:Content><ram:SubjectCode>${note.code}</ram:SubjectCode></ram:IncludedNote>`).join('\n        ')}
    </rsm:ExchangedDocument>
    <rsm:SupplyChainTradeTransaction>${lines}
        <ram:ApplicableHeaderTradeAgreement>
            ${party('SellerTradeParty', inv.seller, true)}
            ${party('BuyerTradeParty', inv.buyer, false)}
        </ram:ApplicableHeaderTradeAgreement>
        <ram:ApplicableHeaderTradeDelivery>
            <ram:ShipToTradeParty><ram:PostalTradeAddress><ram:CountryID>${escape(inv.buyer.address.country || 'FR')}</ram:CountryID></ram:PostalTradeAddress></ram:ShipToTradeParty>
        </ram:ApplicableHeaderTradeDelivery>
        <ram:ApplicableHeaderTradeSettlement>
            <ram:PaymentReference>${escape(inv.number)}</ram:PaymentReference>
            <ram:InvoiceCurrencyCode>${cur}</ram:InvoiceCurrencyCode>
            <ram:SpecifiedTradeSettlementPaymentMeans>
                <ram:TypeCode>${inv.paymentMeans}</ram:TypeCode>${account}
            </ram:SpecifiedTradeSettlementPaymentMeans>${taxes}${allowances}
            <ram:SpecifiedTradePaymentTerms>
                <ram:Description>${escape(inv.paymentTerms)}</ram:Description>
                <ram:DueDateDateTime>${date(inv.dueDate)}</ram:DueDateDateTime>
            </ram:SpecifiedTradePaymentTerms>
            <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
                <ram:LineTotalAmount>${amount(t.lines)}</ram:LineTotalAmount>
                ${optional(t.allowance > 0, `<ram:AllowanceTotalAmount>${amount(t.allowance)}</ram:AllowanceTotalAmount>`)}
                <ram:TaxBasisTotalAmount>${amount(t.basis)}</ram:TaxBasisTotalAmount>
                <ram:TaxTotalAmount currencyID="${cur}">${amount(t.tax)}</ram:TaxTotalAmount>
                <ram:GrandTotalAmount>${amount(t.grand)}</ram:GrandTotalAmount>
                ${optional(t.prepaid > 0, `<ram:TotalPrepaidAmount>${amount(t.prepaid)}</ram:TotalPrepaidAmount>`)}
                <ram:DuePayableAmount>${amount(t.due)}</ram:DuePayableAmount>
            </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        </ram:ApplicableHeaderTradeSettlement>
    </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`
    },
}
