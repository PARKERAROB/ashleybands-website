# Synthetic standard Office fixtures

Generated locally with python-docx and openpyxl. No real program, person, financial or credential
content. Core-property authors are the generating libraries; no human identity is included.

`plan.docx` is a standard Word package with a heading, paragraph and two-column task/status table.
It deliberately retains the normal empty custom-XML bibliography metadata in python-docx's template.
That metadata must pass bounded XML/credential checks instead of being rejected as active content.

`milestones.xlsx` is a standard workbook with a named sheet, inline text cells and an uncalculated
formula. The preview must label formula values as cached, not compute or imply a current result.

The HTTP test uses the standard Word package and adds an escaped script-shaped text string to
prove that previews stay inert while retaining genuine Office package structure.
