/*
 * Copyright (C) 2021  Yomichan Authors
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

class DisplaySentences {
    constructor(display) {
        this._display = display;
        this._eventListeners = new EventListenerCollection();
        this._cache = new Map();
        this._cacheSize = 5;
    }

    prepare() {
        this._display.on("optionsUpdated", this._onOptionsUpdated.bind(this));
        this._onOptionsUpdated({ options: this._display.getOptions() });
    }

    cleanupEntries() {
        this._eventListeners.removeAllEventListeners();
    }

    setupEntry(entry, dictionaryEntryIndex) {
        for (const button of entry.querySelectorAll(
            ".action-display-example-sentences"
        )) {
            const headwordIndex =
                this._getDisplaySentenceButtonHeadwordIndex(button);
            this._eventListeners.addEventListener(
                button,
                "click",
                this._onDisplaySentenceButtonClick.bind(
                    this,
                    dictionaryEntryIndex,
                    headwordIndex
                ),
                false
            );
        }
        for (const button of entry.querySelectorAll(".action-navigate-page")) {
            const page = this._getNavigationButtonPage(button);
            this._eventListeners.addEventListener(
                button,
                "click",
                this._onUpdateSentenceButtonClick.bind(this, page),
                false
            );
        }
    }

    async displaySentences(dictionaryEntryIndex, headwordIndex) {
        const headword = this._getHeadword(dictionaryEntryIndex, headwordIndex);
        if (headword === null) {
            return { audio: null, source: null, valid: false };
        }

        const { term, reading } = headword;

        const progressIndicatorVisible = this._display.progressIndicatorVisible;
        const overrideToken = progressIndicatorVisible.setOverride(true);

        try {
            const sentences = await this._getSentences(term, reading, 1);
            await this._display.displayExampleSentences(
                term,
                reading,
                1,
                sentences
            );
        } finally {
            progressIndicatorVisible.clearOverride(overrideToken);
        }
    }

    async updateSentences(page) {
        const { query, reading } = this._getCurrentSentenceInfo();

        const progressIndicatorVisible = this._display.progressIndicatorVisible;
        const overrideToken = progressIndicatorVisible.setOverride(true);

        try {
            const sentences = await this._getSentences(query, reading, page);
            await this._display.changeExampleSentences(
                query,
                reading,
                page,
                sentences
            );
        } finally {
            progressIndicatorVisible.clearOverride(overrideToken);
        }
    }

    async _getSentences(term, reading, page){
        const cacheEntry = this._getCacheItem(term, reading, page, true);

        if (cacheEntry.new === true) {
            const sentences = await yomichan.api.getSentences(term, reading, page);
            cacheEntry.sentences = sentences;
            cacheEntry.new = false;
        }

        return cacheEntry.sentences;
    }

    _onDisplaySentenceButtonClick(dictionaryEntryIndex, headwordIndex) {
        this.displaySentences(dictionaryEntryIndex, headwordIndex);
    }

    _onUpdateSentenceButtonClick(page) {
        this.updateSentences(page);
    }

    _onOptionsUpdated({ options }) {
        if (options === null) {
            return;
        }
        const { enabled, furigana, cacheSize } = options.exampleSentences;
        const data = document.documentElement.dataset;
        data.exampleSentencesEnabled = `${enabled}`;
        data.exampleSentencesFurigana = `${furigana}`;
        this._cacheSize = cacheSize;
        this._cache.clear();
    }

    _getDisplaySentenceButtonHeadwordIndex(button) {
        const headwordNode = button.closest(".headword");
        if (headwordNode !== null) {
            const headwordIndex = parseInt(headwordNode.dataset.index, 10);
            if (Number.isFinite(headwordIndex)) {
                return headwordIndex;
            }
        }
        return 0;
    }

    _getNavigationButtonPage(button) {
        return parseInt(button.dataset.page);
    }

    _getHeadword(dictionaryEntryIndex, headwordIndex) {
        const { dictionaryEntries } = this._display;
        if (
            dictionaryEntryIndex < 0 ||
            dictionaryEntryIndex >= dictionaryEntries.length
        ) {
            return null;
        }

        const dictionaryEntry = dictionaryEntries[dictionaryEntryIndex];
        if (dictionaryEntry.type === "kanji") {
            return null;
        }

        const { headwords } = dictionaryEntry;
        if (headwordIndex < 0 || headwordIndex >= headwords.length) {
            return null;
        }

        return headwords[headwordIndex];
    }

    _getCurrentSentenceInfo() {
        const url = this._display._history._current.url;
        const urlSearchParams = new URLSearchParams(url);
        const query = this._display._query;
        const reading = urlSearchParams.get("reading");
        const page = urlSearchParams.get("page");
        return { query, reading, page };
    }

    _getCacheItem(term, reading, page, create) {
        const key = this._getTermReadingPageKey(term, reading, page);
        let cacheEntry = this._cache.get(key);
        if (typeof cacheEntry === "undefined" && create) {
            cacheEntry = {
                sentences: [],
                new: true
            };
            this._cache.set(key, cacheEntry);
            this._limitCache();
        }
        return cacheEntry;
    }

    _limitCache() {
        if (this._cache.size > this._cacheSize) {
            const bye = Array.from(this._cache.keys())[0];
            this._cache.delete(bye);
        }
    }

    _getTermReadingPageKey(term, reading, page){
        return JSON.stringify([term, reading, page]);
    }
}
