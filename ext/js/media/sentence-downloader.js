/*
 * Copyright (C) 2017-2021  Yomichan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

class SentenceDownloader {
    constructor({ requestBuilder }) {
        this._requestBuilder = requestBuilder;
    }

    async getSentences(term, reading, page) {
        return await this._getJisho(term, reading, page);
    }

    async _getJisho(term, reading, page) {
        const fetchUrl = `https://jisho.org/search/${term}%20${reading}%23sentences?page=${page}`;
        const response = await this._requestBuilder.fetchAnonymous(fetchUrl, {
            method: "GET",
            mode: "cors",
            cache: "default",
            credentials: "omit",
            redirect: "follow",
            referrerPolicy: "no-referrer",
        });
        const responseText = await response.text();

        const dom = this._createSimpleDOMParser(responseText);
        try {
            const sentencesDom = dom.getElementsByClassName(`sentence_content`);
            if (sentencesDom !== null) {

                let sentences = []
                
                for (const sentenceDom of sentencesDom) {

                    const japaneseSentenceDom = sentenceDom.getElementsByTagName("ul");
                    if (japaneseSentenceDom !== null) {

                        let sentence = {
                            japanese: [],
                            english: ""
                        };

                        const wordsDom = japaneseSentenceDom[0].children;
                        for (const wordDom of wordsDom) {
                            if (wordDom.previousSibling !== null && wordDom.previousSibling.nodeName == "#text") {
                                sentence.japanese.push({
                                    unlinked: "",
                                    furigana: "",
                                    other: wordDom.previousSibling.textContent
                                });
                            }
                            sentence.japanese.push({
                                unlinked: "",
                                furigana: "",
                                other: ""
                            });

                            const unlinked = wordDom.getElementsByClassName("unlinked");
                            if (unlinked !== null) {
                                sentence.japanese[sentence.japanese.length - 1].unlinked = unlinked[0].textContent;
                            }
                            try {
                                const furigana = wordDom.getElementsByClassName("furigana");
                                if (furigana !== null) {
                                    sentence.japanese[sentence.japanese.length-1].furigana = furigana[0].textContent;
                                }
                            } catch (e) {}
                        }

                        // there can be another text after the last element, check for that (fencepost problem)
                        const lastWord = wordsDom[wordsDom.length-1];
                        if (lastWord.nextSibling !== null) {
                            sentence.japanese.push({
                                unlinked: "",
                                furigana: "",
                                other: lastWord.nextSibling.textContent
                            });
                        } 

                        const englishSentenceDom = sentenceDom.getElementsByClassName("english");
                        if(englishSentenceDom !== null){
                            sentence.english = englishSentenceDom[0].textContent;
                        }

                        sentences.push(sentence);
                    }
                }

                sentences.sort((a, b) => {
                    return a.japanese.length - b.japanese.length;
                });
                
                const resultCountDom = dom.getElementsByClassName("result_count");
                const resultCount = parseInt(resultCountDom[0]?.textContent.split(" ")[2]);
                const pageCount = Math.ceil(resultCount / 20);

                sentences.push({
                    resultCount,
                    pageCount
                })

                return sentences;
            }
        } catch (e) {
            // NOP
        }

        throw new Error("Failed to find sentences");
    }

    _createSimpleDOMParser(content) {
        if (
            typeof NativeSimpleDOMParser !== "undefined" &&
            NativeSimpleDOMParser.isSupported()
        ) {
            return new NativeSimpleDOMParser(content);
        } else if (
            typeof SimpleDOMParser !== "undefined" &&
            SimpleDOMParser.isSupported()
        ) {
            return new SimpleDOMParser(content);
        } else {
            throw new Error("DOM parsing not supported");
        }
    }
}
