# Third-Party Notices and Licenses

This application uses third-party libraries and resources. This document provides required attribution and license information for these dependencies.

---

## Runtime Dependencies (CDN)

### 1. Marked.js

**Version:** 11.1.1
**Source:** https://github.com/markedjs/marked
**License:** MIT License
**Used For:** Markdown parsing and rendering

```
MIT License

Copyright (c) 2018+, MarkedJS (https://github.com/markedjs/marked)
Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/marked)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 2. Mermaid.js

**Version:** 10.6.1
**Source:** https://github.com/mermaid-js/mermaid
**License:** MIT License
**Used For:** Diagram generation (flowcharts, sequence diagrams, etc.)

```
MIT License

Copyright (c) 2014 - 2024 Knut Sveidqvist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 3. Highlight.js

**Version:** 11.9.0
**Source:** https://github.com/highlightjs/highlight.js
**License:** BSD 3-Clause License
**Used For:** Syntax highlighting for code blocks

```
BSD 3-Clause License

Copyright (c) 2006, Ivan Sagalaev.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

### 4. CodeMirror 5

**Version:** 5.65.18
**Source:** https://github.com/codemirror/codemirror5
**License:** MIT License
**Used For:** Editor syntax highlighting and code editing

```
MIT License

Copyright (C) 2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Development Dependencies (npm)

### 5. http-server

**Version:** 14.1.1
**Source:** https://github.com/http-party/http-server
**License:** MIT License
**Used For:** Local development server (not included in distribution)

```
MIT License

Copyright (c) 2011-2022 http-party

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## External Resources (CDN)

### 6. MarkedCustomStyles (CSS Themes)

**Source:** https://github.com/ttscoff/MarkedCustomStyles
**Author:** Brett Terpstra (@ttscoff)
**License:** ⚠️ **NO EXPLICIT LICENSE** (See notes below)
**Used For:** Optional CSS styling themes for rendered markdown

**IMPORTANT LICENSING NOTES:**

The MarkedCustomStyles repository currently has **no formal license declaration**. While the repository is public and the README states "Please feel free to fork and submit new styles!", this does NOT constitute a legal license for redistribution.

**Current Status:**
- Repository is public on GitHub
- Author encourages forking and contributions
- No formal license file or declaration
- Legal status for redistribution is **UNCLEAR**

**Recommendation for Users:**
1. If you're using this application **locally only**: No issue
2. If you're **redistributing or forking**: Contact the author for clarification
3. **Alternative**: Don't use these styles, create your own CSS themes

**Author Contact:**
- GitHub: [@ttscoff](https://github.com/ttscoff)
- Repository: https://github.com/ttscoff/MarkedCustomStyles

**What We're Doing:**
This application loads these styles dynamically from the GitHub CDN. We are:
- Giving full attribution to Brett Terpstra
- Not claiming these styles as our own
- Recommending users seek clarification if redistributing
- Providing the option to use custom CSS instead

If you are the author and would like to add a license, we recommend:
- MIT License (most permissive)
- Apache 2.0 License
- Creative Commons CC-BY-4.0 (for creative works)

---

## CDN Providers

This application loads libraries from the following CDN providers:

### jsDelivr
- **Website:** https://www.jsdelivr.com/
- **Libraries Served:** marked.js, mermaid.js, MarkedCustomStyles
- **Terms of Service:** https://www.jsdelivr.com/terms

### Cloudflare CDN (cdnjs)
- **Website:** https://cdnjs.com/
- **Libraries Served:** highlight.js
- **Terms of Service:** https://www.cloudflare.com/website-terms/

---

## License Compatibility

All explicitly licensed dependencies (marked.js, mermaid.js, highlight.js, CodeMirror, http-server) are compatible with the AGPL-3.0 License used by this project. The licenses allow:

- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use

**Conditions:**
- Include license and copyright notice
- Provide attribution

**BSD 3-Clause Additional Requirement:**
- Cannot use contributor names for endorsement without permission

---

## Attribution Requirements

If you redistribute this application or create derivative works, you must:

1. **Include this THIRD-PARTY-NOTICES.md file** (or equivalent attribution)
2. **Include the MIT License** for marked.js, mermaid.js, http-server
3. **Include the BSD 3-Clause License** for highlight.js
4. **Provide attribution** to all library authors
5. **Address the MarkedCustomStyles licensing** (contact author or remove)

---

## Disclaimer

This document is provided for informational purposes. The application developers have made reasonable efforts to ensure license compliance, but:

- License information may change
- Users are responsible for verifying license compliance
- Users should review license terms before redistribution
- For legal advice, consult a lawyer

---

## Updates

This notice was last updated: **2025-11-30**

If you discover any license issues or inaccuracies, please:
- Open an issue on GitHub
- Contact the maintainers
- Submit a pull request with corrections

---

## Summary Table

| Component | License | Commercial Use | Attribution Required | Notes |
|-----------|---------|----------------|---------------------|-------|
| marked.js | MIT | ✅ Yes | ✅ Yes | Compatible |
| mermaid.js | MIT | ✅ Yes | ✅ Yes | Compatible |
| highlight.js | BSD-3 | ✅ Yes | ✅ Yes | Compatible |
| CodeMirror 5 | MIT | ✅ Yes | ✅ Yes | Compatible |
| http-server | MIT | ✅ Yes | ✅ Yes | Dev only |
| MarkedCustomStyles | ⚠️ None | ⚠️ Unclear | ⚠️ Unclear | **NEEDS RESOLUTION** |

---

**For questions about licensing, please open an issue on the project repository.**
