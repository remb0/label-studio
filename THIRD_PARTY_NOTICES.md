# Third-party notices

## Thermoprint

The files initially imported into `src/` (excluding Label Studio additions) and `packages/core/` derive from https://github.com/tomLadder/thermoprint, commit `51967b7bdf6ddfe6e64db6456fad86bf39276e9a`.

Attribution: tomLadder and Thermoprint contributors. The upstream README and core package declare the MIT License. The retrieved snapshot did not contain the LICENSE file referenced by that README; this notice preserves the published license declaration, project attribution and standard MIT permission terms. Any additional upstream notices must be retained when synchronizing future versions.

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Protocol research

- https://github.com/0xMH/fichero-printer (MIT declared upstream): Fichero/LuckPrinter protocol reference. Its 96-dot D11s is not interchangeable with the 384-dot LuckP D1S.
- https://github.com/ChiaraCannolee/thermal-pocket-printer-basic: protocol research cited by the preserved legacy implementation.

Third-party npm package versions and transitive dependencies are pinned in `package-lock.json`; their licenses remain in their distributed packages. Inter and JetBrains Mono font packages retain their upstream Open Font License notices in node_modules and are bundled locally.
