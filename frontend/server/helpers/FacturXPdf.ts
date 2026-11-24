import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { AFRelationship, PDFArray, PDFDict, PDFDocument, PDFHeader, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFString } from 'pdf-lib'
import { FACTURX_PROFILE } from './FacturXXml'

/*
 * The PDF of an invoice drawn by the browser (utils/pdf.ts, jsPDF: real text, the fonts of the site embedded) made a
 * Factur-X file: PDF/A-3b with the CII XML inside.
 *   const bytes = await FacturXPdf.make(pdfBytes, xml, { number, seller, title })
 * What PDF/A-3b asks and what is done here:
 *   - an output intent with an RGB ICC profile (the colors of jsPDF are device RGB / gray): sRGB below
 *   - XMP metadata (pdfaid part 3 / B, the Factur-X extension schema, the same title, author, dates as the Info dictionary)
 *   - the XML attached as factur-x.xml (text/xml, AFRelationship Alternative, listed in /AF of the catalog)
 *   - a file /ID, every annotation printable (/F 4), no unused standard font left in the resources (not embedded)
 */

// sRGB IEC61966-2.1, ICC v2 "micro" profile by Clinton Ingram (Compact-ICC-Profiles, CC0 1.0: public domain), 456 bytes
const SRGB_ICC = 'AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//'

const PRODUCER = 'djason-chery.dev (jsPDF, pdf-lib)'
const xmlText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// 2026-11-23T10:00:00+01:00: the dates of the XMP in the time of the server, like the ones of the Info dictionary
const xmpDate = (d: Date) => {
    const offset = -d.getTimezoneOffset()
    const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0')
    const local = new Date(d.getTime() + offset * 60000).toISOString().slice(0, 19)
    return `${local}${offset >= 0 ? '+' : '-'}${pad(offset / 60)}:${pad(offset % 60)}`
}

const xmp = ({ title, author, date }: { title: string, author: string, date: Date }) => `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:format>application/pdf</dc:format>
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlText(title)}</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>${xmlText(author)}</rdf:li></rdf:Seq></dc:creator>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${PRODUCER}</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>${PRODUCER}</xmp:CreatorTool><xmp:CreateDate>${xmpDate(date)}</xmp:CreateDate><xmp:ModifyDate>${xmpDate(date)}</xmp:ModifyDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>${FACTURX_PROFILE.level}</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>
${[['DocumentFileName', 'The name of the embedded XML document'], ['DocumentType', 'The type of the hybrid document in capital letters, e.g. INVOICE or ORDER'],
    ['Version', 'The actual version of the standard applying to the embedded XML document'], ['ConformanceLevel', 'The conformance level of the embedded XML document']]
    .map(([name, description]) => `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`).join('\n')}
</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

// Fonts named in the resources of a page but never used by its content (jsPDF lists its 14 standard fonts, not embedded)
const dropUnusedFonts = (doc: PDFDocument) => {
    for (const page of doc.getPages()) {
        const fonts = page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict)
        if (!fonts) continue
        const content = page.node.Contents()
        const streams = content instanceof PDFArray ? content.asArray().map(ref => doc.context.lookup(ref)) : [content]
        const text = streams.map(stream => stream instanceof PDFRawStream ? Buffer.from(decode(stream)).toString('latin1') : '').join('\n')
        for (const key of fonts.keys()) if (!new RegExp(`/${key.decodeText()}\\s+[\\d.]+\\s+Tf`).test(text)) fonts.delete(key)
    }
}
// Content of a stream, inflated when compressed
const decode = (stream: PDFRawStream) => {
    const filter = stream.dict.lookup(PDFName.of('Filter'))
    return filter ? inflateSync(stream.contents) : stream.contents
}

export const FacturXPdf = {
    async make(pdf: Uint8Array, xml: string, { number, seller, title }: { number: string, seller: string, title: string }) {
        const doc = await PDFDocument.load(pdf, { updateMetadata: false })
        const date = new Date()
        const docTitle = `Facture ${number}${title ? ` · ${title}` : ''}`

        // Info dictionary: only what the XMP says too
        doc.context.trailerInfo.Info = doc.context.register(doc.context.obj({
            Title: PDFHexString.fromText(docTitle), Author: PDFHexString.fromText(seller), Creator: PDFString.of(PRODUCER), Producer: PDFString.of(PRODUCER),
            CreationDate: PDFString.fromDate(date), ModDate: PDFString.fromDate(date),
        }))
        // Identifier of the file (two equal halves for a new file)
        const id = PDFHexString.of(createHash('md5').update(pdf).update(number).digest('hex'))
        doc.context.trailerInfo.ID = doc.context.obj([id, id])

        // XMP metadata (never compressed: PDF/A wants it readable)
        const metadata = doc.context.stream(Buffer.from(xmp({ title: docTitle, author: seller, date }), 'utf-8'), { Type: 'Metadata', Subtype: 'XML' })
        doc.catalog.set(PDFName.of('Metadata'), doc.context.register(metadata))

        // Output intent: sRGB
        const icc = Buffer.from(SRGB_ICC, 'base64')
        const profile = doc.context.flateStream(icc, { N: 3 })
        doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([doc.context.obj({
            Type: 'OutputIntent', S: 'GTS_PDFA1', OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'), Info: PDFString.of('sRGB IEC61966-2.1'),
            RegistryName: PDFString.of('http://www.color.org'), DestOutputProfile: doc.context.register(profile),
        })]))

        // Every annotation (the links) printable, none hidden
        for (const page of doc.getPages()) {
            const annots = page.node.Annots()
            for (const ref of annots?.asArray() || []) {
                const annot = doc.context.lookup(ref)
                if (annot instanceof PDFDict) annot.set(PDFName.of('F'), PDFNumber.of(4))
            }
        }
        dropUnusedFonts(doc)

        await doc.attach(Buffer.from(xml, 'utf-8'), 'factur-x.xml', {
            mimeType: 'text/xml', description: 'Factur-X invoice', creationDate: date, modificationDate: date, afRelationship: AFRelationship.Alternative,
        })
        // PDF 1.7: the version of PDF/A-3 (jsPDF writes 1.3)
        doc.context.header = PDFHeader.forVersion(1, 7)
        return doc.save({ useObjectStreams: false, updateFieldAppearances: false })
    },
}
