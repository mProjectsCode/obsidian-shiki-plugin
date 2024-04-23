---
test: hello
---

TypeScript codearsiNOM

```ts title="A part of ParsiNOM" {13-15, 22-29} showLineNumbers
export class Parser<const SType extends STypeBase> {
	public p: ParseFunction<SType>;

	constructor(p: ParseFunction<SType>) {
		this.p = p;
	}

	/**
	 * Parses a string, returning a result object.
	 *
	 * @param str
	 */
	tryParse(str: string): ParseResult<SType> {
		return this.p(new ParserContext(str, { index: 0, line: 1, column: 1 }));
	}

	/**
	 * Parses a string, throwing a {@link ParsingError} on failure.
	 *
	 * @param str
	 */
	parse(str: string): SType {
		const result: ParseResult<SType> = this.tryParse(str);
		if (result.success) {
			return result.value;
		} else {
			throw new ParsingError(str, result);
		}
	}
}
```

TypeScript codearsiNOM (wrap set to false)
```ts title="A part of ParsiNOM" {13-15, 22-29} showLineNumbers wrap=false
export class Parser<const SType extends STypeBase> {
	public p: ParseFunction<SType>;

	constructor(p: ParseFunction<SType>) {
		this.p = p;
	}

	/**
	 * Parses a string, returning a result object.
	 *
	 * @param str
	 */
	tryParse(str: string): ParseResult<SType> {
		return this.p(new ParserContext(str, { index: 0, line: 1, column: 1 }));
	}

	/**
	 * Parses a string, throwing a {@link ParsingError} on failure.
	 *
	 * @param str
	 */
	parse(str: string): SType {
		const result: ParseResult<SType> = this.tryParse(str);
		if (result.success) {
			return result.value;
		} else {
			throw new ParsingError(str, result);
		}
	}
}
```

TypeScript codearsiNOM (wrap set to true)
```ts title="A part of ParsiNOM" {13-15, 22-29} showLineNumbers wrap=true
export class Parser<const SType extends STypeBase> {
	public p: ParseFunction<SType>;

	constructor(p: ParseFunction<SType>) {
		this.p = p;
	}

	/**
	 * Parses a string, returning a result object.
	 *
	 * @param str
	 */
	tryParse(str: string): ParseResult<SType> {
		return this.p(new ParserContext(str, { index: 0, line: 1, column: 1 }));
	}

	/**
	 * Parses a string, throwing a {@link ParsingError} on failure.
	 *
	 * @param str
	 */
	parse(str: string): SType {
		const result: ParseResult<SType> = this.tryParse(str);
		if (result.success) {
			return result.value;
		} else {
			throw new ParsingError(str, result);
		}
	}
}
```

CSS code

```css title="Some CSS by sailKite" showLineNumbers {2} ins={6-8, 15-17} del={15-17}
input:is([data-task="式"], [data-task="式"] > *):checked::after {
    content: "式";
    color: transparent;
    font-weight: 600;
    text-align: center;
    -webkit-mask-image: linear-gradient(black, white);
    -webkit-mask-size: 100%;
    -webkit-mask-clip: text;
}
input:is([data-task="字"], [data-task="字"] > *):checked::after {
    content: "字";
    color: transparent;
    font-weight: 600;
    text-align: center;
    -webkit-mask-image: linear-gradient(black, white);
    -webkit-mask-size: 100%;
    -webkit-mask-clip: text;
}
```

```css
input:is([data-task="式"], [data-task="式"] > *):checked::after {
    content: "式";
    color: transparent;
    font-weight: 600;
    text-align: center;
    -webkit-mask-image: linear-gradient(black, white);
    -webkit-mask-size: 100%;
    -webkit-mask-clip: text;
}
input:is([data-task="字"], [data-task="字"] > *):checked::after {
    content: "字";
    color: transparent;
    font-weight: 600;
    text-align: center;
    -webkit-mask-image: linear-gradient(black, white);
    -webkit-mask-size: 100%;
    -webkit-mask-clip: text;
}
```

Bash

```bash title="Other Title"
echo "Hello"
```

```diff
+ this line will be marked as inserted
- this line will be marked as deleted
  this is a regular line
```

> [!NOTE]
> ```diff showLineNumbers
> + this line will be marked as inserted
> - this line will be marked as deleted
>   this is a regular line
> ```


Javascript Wrapping tests
```ts title="Global Setting" showLineNumbers
const pagebuttons = ["`button-page1` ", "`button-page2` ", "`button-page3` ", "`button-page4` ", "`button-page5` ", "`button-page6` ", "`button-page7`", "`button-page8`", "`button-page9`", "`button-page10`", "`button-page11`", "`button-page12`", "`button-page13`", "`button-page14`", "`button-page15`", "`button-page16`", "`button-page17`", "`button-page18`", "`button-page19`", "`button-page20`", "`button-page21`", "`button-page22`", "`button-page23`", "`button-page24`", "`button-page25`"];

function arrayContains(str, filter){
	return (str?.split(" ").some(r => filter?.includes(r)) || !filter);
}
```

Javascript
```ts title="Always Wrapping" showLineNumbers wrap=true
const pagebuttons = ["`button-page1` ", "`button-page2` ", "`button-page3` ", "`button-page4` ", "`button-page5` ", "`button-page6` ", "`button-page7`", "`button-page8`", "`button-page9`", "`button-page10`", "`button-page11`", "`button-page12`", "`button-page13`", "`button-page14`", "`button-page15`", "`button-page16`", "`button-page17`", "`button-page18`", "`button-page19`", "`button-page20`", "`button-page21`", "`button-page22`", "`button-page23`", "`button-page24`", "`button-page25`"];

function arrayContains(str, filter){
	return (str?.split(" ").some(r => filter?.includes(r)) || !filter);
}
```

Javascript
```ts title="Never Wrapping" showLineNumbers wrap=false
const pagebuttons = ["`button-page1` ", "`button-page2` ", "`button-page3` ", "`button-page4` ", "`button-page5` ", "`button-page6` ", "`button-page7`", "`button-page8`", "`button-page9`", "`button-page10`", "`button-page11`", "`button-page12`", "`button-page13`", "`button-page14`", "`button-page15`", "`button-page16`", "`button-page17`", "`button-page18`", "`button-page19`", "`button-page20`", "`button-page21`", "`button-page22`", "`button-page23`", "`button-page24`", "`button-page25`"];

function arrayContains(str, filter){
	return (str?.split(" ").some(r => filter?.includes(r)) || !filter);
}
```
