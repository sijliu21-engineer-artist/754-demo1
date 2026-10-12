from pathlib import Path
p=Path('src/App.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('<Button onClick={() => nav("assistant")}>', '<Button className="ai-text" onClick={() => nav("assistant")}>')
s=s.replace('<Button className="report-action" onClick={() => nav("assistant")}>', '<Button className="report-action ai-text" onClick={() => nav("assistant")}>')
s=s.replace('<h1>{title}</h1>', '<h1 className={title === "Records assistant" ? "ai-title" : undefined}>{title}</h1>')
s=s.replace('<span>{label}</span>','<span className={label === "AI generation" ? "ai-text" : undefined}>{label}</span>',1)
s=s.replace('<h2>Ask AI&nbsp; · &nbsp;Find test results</h2>', '<h2 className="ai-text">Ask AI&nbsp; · &nbsp;Find test results</h2>')
s=s.replace('<small>Source: AI summary</small>','<small className="ai-text">Source: AI summary</small>').replace('<small>Source: AI generated</small>','<small className="ai-text">Source: AI generated</small>')
s=s.replace('<small>\n                      {record.extractionStatus', '<small className={record.extractionStatus === "ready" ? "ai-text" : undefined}>\n                      {record.extractionStatus')
s=s.replace('<small>AI may make mistakes · Verify against original records</small>', '<small className="ai-text">AI may make mistakes · Verify against original records</small>')
p.write_text(s,encoding='utf-8')
p=Path('src/components/UploadedReport.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('<section className="card" key={key}>','<section className="card ai-generated-content" key={key}>')
s=s.replace('<p className="caption">AI-organized record extracts', '<p className="caption ai-text">AI-organized record extracts')
p.write_text(s,encoding='utf-8')
p=Path('src/index.css');s=p.read_text(encoding='utf-8')
s+='''
/* AI entry points and generated content share one text color. */
.ai-text,
.button.ai-text,
.ai-message,
.ai-message strong,
.ai-message p,
.ai-thinking,
.ai-generated-content,
.ai-generated-content h2,
.ai-generated-content small,
.ai-generated-content p {
  color: #b42318;
}
.topbar .ai-title { color: #ff9b91; }
'''
p.write_text(s,encoding='utf-8')
