---
test: hello
---

```ts
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
