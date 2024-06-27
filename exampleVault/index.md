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

Inline code

`{jsx} <button role="button" />`
