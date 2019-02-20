cc.Class({
    extends: cc.Component,

    properties: {
        label: {
            default: null,
            type: cc.Label
        },
        tableView: {
            default: null,
            type: require("TableView"),
        },
        // defaults, set visually when attaching this script to the Canvas
        text: 'Hello, World!',
        _selectIdx: -1,
    },

    // use this for initialization
    onLoad: function () {
        this.label.string = this.text;
        // let selectIdx = 2;
        let self = this;
        this.tableView.setCellCreateHandler(function (tableView, cellNode) {
            let cell = cellNode.getComponent("TableViewCell");
            if (cell) {
                cell.setClickHandler(function (index) {
                    if (self._selectIdx === index) {
                        self._selectIdx = -1;
                        tableView.hideDetail();
                    }
                    else {
                        self._selectIdx = index;
                        tableView.showDetailForIndex(index);
                    }
                })
            }
        })
        .setCellUpdateHandler(function (tableView, index, cellNode) {
            let cell = cellNode.getComponent("TableViewCell");
            if (cell) {
                cell.updateLayerInfo(index);
            }
        })
        // .setTopKeep(10)
        // .setBottomKeep(10)
        // .setCellSizeHandler(function (index) {
        //     return index == selectIdx ? cc.size(0, 100) : null;
        // })
        .reloadWithLength(10)
        .scrollToIndex(1)
    },

    // called every frame
    update: function (dt) {

    },
});
