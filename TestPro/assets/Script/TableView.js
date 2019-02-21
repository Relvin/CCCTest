
/********************************************
*   所有者      : Relvin
*   创建时间    : 2019年02月16日10:58:10
*   功能描述    : TableView
*********************************************/

if (!Array.prototype.remove) {
    Array.prototype.remove = function(value) {
        let idx = this.indexOf(value);
        if (idx > -1) {
            this.splice(idx, 1);
        }
        return this;
    }
}

if (!Array.prototype.clear) {
    Array.prototype.clear = function() {
        this.length = 0;
        return this;
    }
}

let Direction = cc.Enum({
    HORIZONTAL:  0,
    VERTICAL: 1,
});

let VerticalFillOrder = cc.Enum({
    TOP_DOWN:  0,
    BOTTOM_UP: 1,
});

const CC_INVALID_INDEX = -1;

let TableView = cc.Class({
    // name: 'TableView',
    extends: cc.ScrollView,
    editor: CC_EDITOR && {
        menu: '添加 UI 组件/TableView(自定义)',
        help: '',
        inspector: 'packages://TableView/inspector.js',
    },
    properties: {
        _init : false,              // 防止tableView显示之前调用加载接口
        _cellCout: 0,
        _indices: [],               // 显示cell的索引
        _cellsUsed: [],             // 显示的cells
        _bottomKeep: 0,             // 底端预留像素
        _topKeep: 0,                // 顶端预留像素
        _cellSize: cc.size(0,0),    // cell的宽高
        _isUsedCellsDirty: false,
        _defaultScrollIdx: 0,       // 默认滚动位置
        // _
        _vordring: VerticalFillOrder.TOP_DOWN,

        _vCellsPositions: [],       // cell的位置信息
        _cellPool: null,            // cell缓存池
        _needReload: false,         // 是否需要重新加载
        _resetOffset: false,        // 是否需要重置偏移
        _showDetail: false,         // 是否显示详情
        _detailY: 0,
        _detailNodeSize: cc.size(0,0),// 详情大小
        _detailIndex: -1,           // 详情显示的索引
        _maxUsdCnt: 0,              // 最大显示数量
        _detailFunc: null,          // 详情显示回调
        _cellUpdateFunc: null,      // cell刷新回调
        _cellCreateFunc: null,      // cell显示回调
        _cellRecycleFunc: null,     // cell回收回调
        _cellSizeHandler: null,     // 获取cellsize

        cellPrefab: {
            default: undefined,
            type: cc.Prefab,
            displayName: '预制体'
        },
        detailNode: {
            type: cc.Node,
            default: null,
            displayName: '详情界面'
        },
        direction: {
            default : Direction.VERTICAL,
            type: Direction,
            notify: function() {
                if (this.direction === Direction.VERTICAL) {
                    this.vertical = true;
                    this.horizontal = false;
                    this.horizontalScrollBar = null;
                }
                else {
                    this.horizontal = true;
                    this.vertical = false;
                    this.verticalScrollBar = null;
                }
            },
            displayName: '滚动方向'
        },
    },

    onLoad () {
        let self = this;
        self.content.setAnchorPoint(0, 0);
        let cellPool = new cc.NodePool("cell-pool");
        self._cellPool = cellPool;
        // self._vordring = 1; // 测试使用
        let cell = self._getCellNode();
        self._cellSize.set(cell.getContentSize());
        self._recycleCell(cell);

        if (this.direction === Direction.VERTICAL) {
            this.vertical = true;
            this.horizontal = false;
        }
        else {
            this.horizontal = true;
            this.vertical = false;
        }
        self._initDetailNode();
        self._init = true;
        self.reloadData();
        if (self._defaultScrollIdx) {
            self.scrollToIndex(self._defaultScrollIdx);
        }
    },

    _initDetailNode () {
        let self = this;
        let detailNode = self.detailNode;
        if (detailNode) {
            let width = this._view.width;
            detailNode.parent = self.content;
            detailNode.x = width * 0.5;
            detailNode.active = false;
            detailNode.zIndex = -1;
            self._detailNodeSize.set(detailNode.getContentSize());
        }
    },

    setDetailHandler (handler) {
        this._detailFunc = handler;
    },

    showDetailForIndex (index) {
        let self = this;
        if (self._showDetail && self._detailIndex === index) {
            return self;
        }
        let detailNode = self.detailNode;
        if (!detailNode) {
            return self;
        }
        let lastCell = self.cellAtIndex(self._detailIndex);
        if (lastCell) {
            self._execUpdateHandler(lastCell);
        }
        self._detailIndex = index;
        detailNode.active = true;
        let cell = self.cellAtIndex(index);
        if (self._detailFunc) {
            self._detailFunc(self, index, cell, detailNode);
        }
        self._execUpdateHandler(cell);
        self._updateDetailNodePosition(index);

        let offset = self.getContentTopOffset();

        self._showDetail = true;
        self._updateContentSize();
        self._updateCellsPosition();

        self.scrollToOffset(offset);
        self._scrollDetailCellInView();
        return self;
    },

    _scrollDetailCellInView () {
        let self = this;
        let offset = self.getContentOffset();
        let position = self._offsetFromIndex(self._detailIndex, true);
        position.addSelf(offset);

        switch (self.direction) {
            case Direction.HORIZONTAL:
            {
                break;
            }
            default:
            {
                let offsetY = position.y;
                if (offsetY < 0) {
                    let offset = self.getContentTopOffset();
                    offset.y -= offsetY;
                    self.scrollToOffset(offset);
                }
                break;
            }
        }
    },

    _updateDetailNodePosition (index) {
        let self = this;
        let detailNode = self.detailNode;
        if (!detailNode) {
            return;
        }
        let position = self._offsetFromIndex(index, true);
        self._detailY = position.y;
        detailNode.y = position.y + detailNode.anchorY * detailNode.height;
    },

    _updateCellsPosition () {
        let self = this;
        let cellsUsed = self._cellsUsed;
        for (let idx = 0, len = cellsUsed.length; idx < len; idx++) {
            let cell = cellsUsed[idx];
            if (cell) {
                self._setIndexForCell(cell._kIdx, cell);
            }
        }
    },

    hideDetail () {
        let self = this;
        if (!self._showDetail) {
            return self;
        }
        let detailNode = self.detailNode;
        if (!detailNode) {
            return self;
        }
        detailNode.active = false;
        self._showDetail = false;

        let cell = self.cellAtIndex(self._detailIndex);
        self._execUpdateHandler(cell);

        self._detailIndex = -1;
        let offset = self.getContentTopOffset();
        self._updateContentSize();
        self._updateCellsPosition();
        self.scrollToOffset(offset);
        return self;
    },

    setCellCount (cellCount) {
        let self = this;
        if (self._cellCout !== cellCount) {
            self._needReload = true;
            self._cellCout = cellCount;
        }
        return self;
    },

    setCellCreateHandler(callFunc) {
        let self = this;
        self._cellCreateFunc = callFunc;
        return self;
    },

    setCellUpdateHandler(callFunc) {
        let self = this;
        self._cellUpdateFunc = callFunc;
        return self;
    },

    _execUpdateHandler(cell) {
        if (!cell) {
            return;
        }
        let self = this;
        let updateFunc = self._cellUpdateFunc;
        if (updateFunc) {
            updateFunc(self, cell._kIdx, cell);
        }
    },

    setCellSizeHandler(callFunc) {
        let self = this;
        self._cellSizeHandler = callFunc;
        return self;
    },

    setCellRecycleHandler(callFunc) {
        let self = this;
        self._cellRecycleFunc = callFunc;
        return self;
    },

    setBottomKeep (keep) {
        let self = this;
        self._bottomKeep = keep;
        return self;
    },

    setTopKeep (keep) {
        let self = this;
        self._topKeep = keep;
        return self;
    },

    reloadData (force) {
        let self = this;
        if (!self._init) {
            return self;
        }
        if (self._needReload || force) {
            self._resetOffset = true;
            self._reloadData();
            self._needReload = false;
        }
        else {
            self.refreshAllCell();
        }
        return self;
    },

    reloadWithLength (length, force) {
        let self = this;
        self.setCellCount(length)
            .reloadData(force);
        return self;
    },

    refreshAllCell() {
        let self = this;
        if (!self._init) {
            return self;
        }

        let cellsUsed = self._cellsUsed;
        for (let idx = 0, len = cellsUsed.length; idx < len; idx++) {
            self._execUpdateHandler(cellsUsed[idx]);
        }
        
        return self;
    },

    setContentPosition(position) {
        let self = this;
        self._super(position);
        self.scrollViewDidScroll();
    },

    _getCellNode () {
        let self = this;
        let cell = self._cellPool.get();
        if (!cell) {
            cell = cc.instantiate(self.cellPrefab);
        }
        cell._kIdx = CC_INVALID_INDEX;
        let createFunc = self._cellCreateFunc;
        if (createFunc) {
            createFunc(self, cell);
        }
        return cell;
    },

    _recycleCell (cell) {
        let self = this;
        if (cell._kIdx !== CC_INVALID_INDEX) {
            let recycleFunc = self._cellRecycleFunc;
            if (recycleFunc) {
                recycleFunc(self, cell._kIdx, cell);
            }
            self._indices.remove(cell._kIdx);
            self._cellsUsed.remove(cell);
            cell._kIdx = CC_INVALID_INDEX;
        }
        self._cellPool.put(cell);
    },

    _reloadData () {
        let self = this;
        let cellsUsed = self._cellsUsed;
        let idx = cellsUsed.length - 1;
        while (idx >= 0) {
            let cell = cellsUsed[idx--];
            this._recycleCell(cell);
        }
        self._cellsUsed.clear();
        self._indices.clear();
        self._updateCellPositions();
        self._updateContentSize();
        let usedCount = self._cellsUsed.length;
        self._maxUsdCnt = Math.max(self._maxUsdCnt, usedCount);
    },

    _updateCellPositions () {
        let self = this;
        let cellCount = self._cellCout;
        if (cellCount > 0) {
            let cellsPos = self._vCellsPositions;
            cellsPos.clear();
            let curPos = 0;
            let vordring = self._vordring;
            if (vordring === VerticalFillOrder.TOP_DOWN) {
                curPos += self._topKeep;
            }
            else {
                curPos += self._bottomKeep;
            }
            for (let idx = 0; idx < cellCount; ++idx) {
                let cellSize = self.cellSizeForIndex(idx);
                let offset = self.direction === Direction.HORIZONTAL ? cellSize.width : cellSize.height;
                cellsPos[idx] = curPos;
                curPos += offset;
            }
            if (vordring === VerticalFillOrder.TOP_DOWN) {
                curPos += self._bottomKeep;
            }
            else {
                curPos += self._topKeep;
            }
            cellsPos[cellCount] = curPos;//1 extra value allows us to get right/bottom of the last cell
        }
    },

    _updateContentSize () {
        let self = this;
        let size = self._view.getContentSize();
        let cellCount = self._cellCout;

        let detailSize = self._detailNodeSize;
        if (cellCount > 0) {
            let maxPos = self._vCellsPositions[cellCount];
            switch (self.direction) {
                case Direction.HORIZONTAL: {
                    size.width = maxPos;
                    if (self._showDetail) {
                        size.width += detailSize.width;
                    }
                    break;
                }
                default: {
                    size.height = maxPos;
                    if (self._showDetail) {
                        size.height += detailSize.height;
                    }
                    break;
                }
            }
        }
        
        self.content.setContentSize(size);
        if (self._resetOffset) {
            self._resetOffset = false;
            self.stopAutoScroll();
            if (self.direction === Direction.HORIZONTAL) {
                self.scrollToLeft();
            }
            else {
                self.scrollToTop();
            }
        }
    },

    scrollViewDidScroll() {
        let self = this;
        let cellCount = self._cellCout;
        if (cellCount === 0) {
            return;
        }

        let cellsUsed = self._cellsUsed;
        if (self._isUsedCellsDirty) {
            self._isUsedCellsDirty = false;
            cellsUsed.sort((a, b) => a._kIdx - b._kIdx);
        }

        let offset = self.getContentOffset();
        offset.mulSelf(-1);
        let viewSize = self._view.getContentSize();
        
        let vHeight = viewSize.height / self.content.scaleY;
        let offsetY = self._vordring === VerticalFillOrder.TOP_DOWN ? vHeight : 0;
        offsetY += offset.y;
        
        let maxUsdCnt = self._maxUsdCnt;
        let startIdx = self._indexFromOffset(offset.x, offsetY);
        let maxIdx = Math.max(0, cellCount - 1);
        startIdx = startIdx === CC_INVALID_INDEX ? maxIdx : startIdx;
        
        if (self._vordring === VerticalFillOrder.TOP_DOWN) {
            offsetY = offset.y;
        }
        else {
            offsetY += vHeight;
        }
        offset.x += viewSize.width / self.content.scaleX;
        
        let endIdx = self._indexFromOffset(offset.x, offsetY);
        endIdx = endIdx === CC_INVALID_INDEX ? maxIdx : endIdx;

        // 优化滑动到超过边界会被无故更新问题
        if (endIdx < (startIdx + maxUsdCnt - 1)) {
            if (startIdx === 0) {
                endIdx = Math.max(endIdx, startIdx + maxUsdCnt - 1);
                endIdx = Math.min(endIdx, maxIdx);
            }
            else if (endIdx === maxIdx) {
                startIdx = Math.min(startIdx, endIdx - maxUsdCnt + 1);
            }
        }
        { // 限定局部变量作用域
            let cell = cellsUsed[0];
            while (cell && cell._kIdx < startIdx) {
                self._moveCellOutOfSight(cell);
                cell = cellsUsed[0];
            }
    
            cell = cellsUsed[cellsUsed.length - 1];
            while (cell && cell._kIdx > endIdx && cell._kIdx <= maxIdx) {
                self._moveCellOutOfSight(cell);
                cell = cellsUsed[cellsUsed.length - 1];
            }
        }

        let indices = self._indices;
        for (let idx = startIdx; idx <= endIdx; idx++) {
            if (indices.indexOf(idx) > -1) {
                continue;
            }
            self.updateCellAtIndex(idx);
        }
    },

    _indexFromOffset (offsetX, offsetY) {
        if (offsetY == null) {
            offsetY = offsetX.y;
            offsetX = offsetX.x;
        }
        let self = this;
        let cellCount = self._cellCout;
        if (cellCount === 0) {
            return CC_INVALID_INDEX;
        }
        if (self._vordring === VerticalFillOrder.TOP_DOWN) {
            offsetY = self.content.height - offsetY;
        }
        let high = Math.max(0, cellCount - 1);
        let search = self.direction === Direction.HORIZONTAL ? offsetX : offsetY;
        let low = 0;
        let vCellPos = self._vCellsPositions;

        // 使用二分查找
        while (high >= low) {
            let index = low + Math.floor((high - low) * 0.5);
            let cellStart = vCellPos[index] + self._getCellAddByIndex(index);
            let cellEnd = vCellPos[index + 1] + self._getCellAddByIndex(index + 1);
            if (search >= cellStart && search <= cellEnd) {
                return index;
            }
            else if (search < cellStart) {
                high = index - 1;
            }
            else {
                low = index + 1;
            }
        }

        if (low <= 0) {
            return 0;
        }

        return CC_INVALID_INDEX;
    },

    _getCellAddByIndex (index) {
        let self = this;
        let add = 0;
        if (self._showDetail) {
            if (self._vordring === VerticalFillOrder.TOP_DOWN) {
                if (index > self._detailIndex) {
                    add = self._detailNodeSize.height;
                }
            }
            else {
                if (index >= self._detailIndex) {
                    add = self._detailNodeSize.height;
                }
            }
        }
        return add;
    },

    cellAtIndex (idx) {
        let self = this;
        if (self._indices.indexOf(idx) > -1) {
            let cellsUsed = self._cellsUsed;
            for (let idx = 0, len = cellsUsed.length; idx < len; idx++) {
                let cell = cellsUsed[idx];
                if (cell._kIdx === idx) {
                    return cell;
                }
            }
        }

        return null;
    },

    _setIndexForCell (idx, cell) {
        let self = this;
        let viewSize = self._view.getContentSize();
        let position = this._offsetFromIndex(idx);
        let cellSize = this.cellSizeForIndex(idx);
        let anchorPoint = cell.getAnchorPoint();

        if (self.direction === Direction.HORIZONTAL) {
            position.x += anchorPoint.x * cellSize.width;
            position.y = (viewSize.height * 0.5 + (anchorPoint.y - 0.5) * cellSize.height);
        }
        else {
            position.x = (viewSize.width * 0.5 + (anchorPoint.x - 0.5) * cellSize.width);
            position.y += anchorPoint.y * cellSize.height;
        }

        cell.position = position;
        cell._kIdx = idx;
    },

    _offsetFromIndex(index, isDetail) {
        let self = this;
        isDetail = isDetail || false;
        let offset = cc.v2(0, 0);
        let content = self.content;
        let size = content.getContentSize();

        let detailSize = self._detailNodeSize;
        let detailIndex = self._detailIndex;
        
        switch (self.direction) {
            case Direction.HORIZONTAL:
            {
                offset.x = self._vCellsPositions[index];
                if (self._showDetail) {
                    if (index >= detailIndex) {
                        offset.x += detailSize.width;
                    }
                }
                break;
            }
            default:
            {
                offset.y = self._vCellsPositions[index];
                if (self._vordring === VerticalFillOrder.TOP_DOWN) {
                    let cellSize = self.cellSizeForIndex(index);
                    offset.y = size.height - offset.y - cellSize.height;
                    if (self._showDetail) {
                        if (index > detailIndex || isDetail) {
                            offset.y -= detailSize.height;
                        }
                    }
                }
                else {
                    if (self._showDetail) {
                        if (index >= detailIndex && !isDetail) {
                            offset.y += detailSize.height;
                        }
                    }
                }
                break;
            }
        }
        return offset;
    },

    _addCellIfNecessary (cell) {
        if (!cell) {
            return;
        }
        let self = this;
        cell.parent = self.content;
        self._cellsUsed.push(cell);
        self._indices.push(cell._kIdx);
        self._isUsedCellsDirty = true;
        self._execUpdateHandler(cell);
    },

    _moveCellOutOfSight (cell) {
        let self = this;
        self._recycleCell(cell);
        self._isUsedCellsDirty = true;
    },

    updateCellAtIndex (idx) {
        if (idx === CC_INVALID_INDEX) {
            return;
        }

        let self = this;
        let cellCount = self._cellCout;
        if (cellCount === 0 || idx >= cellCount) {
            return;
        }

        let cell = self.cellAtIndex(idx);
        if (cell) {
            self._moveCellOutOfSight(cell);
        }
        cell = self._getCellNode();
        self._setIndexForCell(idx, cell);
        self._addCellIfNecessary(cell);
    },

    getContentOffset () {
        let self = this;
        let view = self._view;
        let anchorPoint = view.getAnchorPoint();
        let size = view.getContentSize();
        let pos = self.content.position;
        pos.x += size.width * anchorPoint.x;
        pos.y += size.height * anchorPoint.y;
        return pos;
    },

    getContentTopOffset () {
        let self = this;
        let view = self._view;
        let anchorPoint = view.getAnchorPoint();
        let viewSize = view.getContentSize();
        let content = self.content;
        let contSize = content.getContentSize();
        let pos = content.position;
        pos.y += contSize.height;

        pos.x += viewSize.width * anchorPoint.x;
        pos.y -= viewSize.height * (1 - anchorPoint.y);

        return pos;
    },

    /**
     * index 为了后期扩展预留
     * @param {*} index 
     */
    cellSizeForIndex (index) {
        let self = this;
        let cellSizeHandler = self._cellSizeHandler;
        if (cellSizeHandler) {
            let size = cellSizeHandler(index);
            if (size && size instanceof cc.Size) {
                return size;
            }
        }
        return this._cellSize;
    },

    scrollToIndex(index, time) {
        let self = this;
        if (!self._init) {
            self._defaultScrollIdx = index;
            return;
        }
        self._defaultScrollIdx = 0;
        let cellCount = self._cellCout;
        if (cellCount === 0 || index < 0 || index > cellCount - 1) {
            return;
        }
        let offset = self._offsetFromIndex(index);
        switch (self.direction) {
            case Direction.HORIZONTAL:
            {
                break;
            }
            default:
            {
                let size = self.content.getContentSize();
                let cellSize = self.cellSizeForIndex(index);
                let offsetY = offset.y;
                offset.y = size.height - offsetY - cellSize.height;
                break;
            }
        }
        self.scrollToOffset(offset, time);
        return self;
    }

});

cc.TableView = module.export = TableView;