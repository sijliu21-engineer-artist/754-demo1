# Medical Images to AI-Generated Structured Case Reports

This directory records the research process: V1.0 inputs and outputs and an evolving V2.0 template. These materials document iteration and contributions. Their inclusion does not establish implemented application features or require adoption in the final application.

## Contribution — October 11, 2026

- Archive the supplied V1.0 input/output examples and original case images.
- Share the evolving V2.0 structured case-data template for team discussion.
- Add a file inventory, source package identifiers, and SHA-256 checksums.

## Directory structure

```text
docs/medical-report-research/
├── README.md
├── MANIFEST.md
├── v1.0/
│   ├── input-output-examples/
│   │   ├── RA01-original/
│   │   ├── RA02-original/
│   │   ├── RA01-report.docx
│   │   ├── RA02-report.docx
│   │   └── RA02-images.pdf
│   └── case-data/
│       └── case-001/
│           ├── medical-record-01.jpg
│           ├── medical-record-02.jpg
│           └── medical-record-03.jpg
└── v2.0/
    └── structured-case-report-template-v2.0.xlsx
```

## Materials

| Version | File | Purpose and status |
| --- | --- | --- |
| V1.0 | [Input/output examples](v1.0/input-output-examples/) | Original images, PDF, and existing RA01/RA02 reports. |
| V1.0 reference | [Original case images](v1.0/case-data/case-001/) | Three original JPGs; no corresponding AI output is claimed. |
| V2.0 | [Structured case-data template](v2.0/structured-case-report-template-v2.0.xlsx) | Work in progress; final fields and application integration remain undecided. |
| Inventory | [Manifest and checksums](MANIFEST.md) | File sizes, checksums, and source package identifiers. |

## Review workflow

1. Browse or download the extracted V1.0 examples. Use RA01/RA02 identifiers to locate inputs and reports.
2. Open the V2.0 workbook in Excel and discuss its structure alongside the examples.
3. Document future revisions, sample provenance, and validation findings in separate pull requests.

The contents of the supplied files remain byte-for-byte unchanged. Archives are extracted for direct browsing; the workbook and extracted source files use English filenames. Source package identifiers are recorded in the manifest. Document and image contents retain their original language. This contribution does not include a field-by-field version comparison or verification of reports against source records. The archive alone does not establish medical accuracy or feature completion.

## Authorization and use

The contributor explicitly confirmed authorization to share these real medical materials in this GitHub project before submission. This is a specific exception for these materials; the repository's default rules for other medical records remain unchanged. This confirmation is not an independent legal review.

The materials support project research, version comparison, and team discussion. Submission authorization should not be assumed to permit redistribution or unrelated uses. Research outputs require comparison with original records.

## Relationship to the application

Application code does not reference this directory. This contribution changes no frontend, backend, prompts, database, or runtime configuration. Adopting the V2.0 template or field mappings requires a separate team decision and implementation review.