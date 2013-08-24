var ABCD = {};
(function(NS) {
    var FPS = 60;
    var WINDOW_SIZE = 15; // 画面サイズ
    var PX = 32;
    var MAP_FILE = 'img/map.gif';
    var WALL = 8;
    var ROOM = 3;
    var LOAD = 3;

    NS.initialize = function() {
        var game = new Game(WINDOW_SIZE * PX, WINDOW_SIZE * PX);
        game.fps = FPS;

        game.preload(
                MAP_FILE
                , 'img/chara0.png'
                );

        return game;
    }

    NS.Key = (function() {
        /**
         * key.get('z')で押されているか判定できる
         * onceだと一回getするごとにfalseにする
         * 同時押しは2個までしか対応しない. イベントが発行されない模様
         * 
         * @param {Object} keys
         * @param {Game} game
         * @returns {void}
         */
        function Key(keys, game) {
            var i, name, number, key, keyobj = this;
            this.keys = {};

            for (i = 0; i < keys.length; i++) {
                name = keys[i].name;
                number = keys[i].number != null ? keys[i].number
                        : name.toUpperCase().charCodeAt(0);
                this.keys[name] = {
                    once: keys[i].once,
                    number: number,
                    value: false
                };
                game.keybind(number, name);
                game.addEventListener(name + 'buttonup', function(e) {
                    name = e.type.substr(0, e.type.length - 8);
                    key = keyobj.keys[name];
                    if (!key['once'])
                        key['value'] = false;
                    // downイベント設定
                    game.addEventListener(name + 'buttondown', function(e) {
                        name = e.type.substr(0, e.type.length - 10);
                        key = keyobj.keys[name];

                        //downイベント削除
                        game.clearEventListener(e.type);
                        key['value'] = true;
                    });
                });
                // 一回upイベントを発行して、downイベントを設定
                game.dispatchEvent(new enchant.Event(name + 'buttonup'));
            }
        }

        /**
         * 押されているかの判定を返すメソッド
         * 
         * @param {String} name
         * @returns {Boolean}
         */
        Key.prototype.get = function(name) {
            var ret;
            if (typeof this.keys[name] === 'undefined')
                return false;
            ret = this.keys[name]['value'];
            if (this.keys[name]['once'])
                this.keys[name]['value'] = false;
            return ret;
        }

        /**
         * onceのものをリセットする
         * 各フレームで一回呼ぶようにする
         * 
         * @returns {undefined}
         */
        Key.prototype.reset = function() {
            var key;
            for (key in this.binded) {
                if (this.once[key]) {
                    this.binded[key] = false;
                }
            }
        }

        return Key;
    })();
    NS.MapData = (function() {
        /**
         * マップのデータを生成するクラス
         */
        function MapData() {
            // パラメータ。いじりたかったらいじる。
            this.wallWidth = 5;
            this.pathWidth = 3;
            this.minDelta = this.pathWidth * 5;
            this.max_delta = this.pathWidth * 20;
            this.splitProb = 0.65; // 部屋分割を行う確率
            this.addPathProb = 0.25; // 通路追加確率
            this.width = 150;
            this.height = 100;

            this.data = new Array(this.height); // 画像用二次元配列
            this.colData = new Array(this.height); // 当たり判定用二次元配列 0:ok, 1:hit
            for (i = 0; i < this.height; i++) {
                this.data[i] = new Array(this.width);
                this.colData[i] = new Array(this.width);
            }
        }
        /**
         * mapの分割の再帰関数
         * 
         * @param {Section} section
         * @param {int} direction 0:縦  1:横
         * @param {boolean} retry
         * @returns {void}
         */
        var _split = function(section, direction, retry) {
            var x1 = section.rect.x1
                    , y1 = section.rect.y1
                    , x2 = section.rect.x2
                    , y2 = section.rect.y2
                    , delta = direction ? x2 - x1 : y2 - y1
                    , newSection, border, path, i
                    ;

            if (delta < this.minDelta * 2 + this.wallWidth * 2 + this.pathWidth ||
                    (delta <= this.maxDelta && this.splitProb < Math.random())) {
                if (retry) {
                    section.makeRoom(this.minDelta);
                    this.sections.push(section);
                    _fill.call(this, section.room, ROOM, 0);
                } else {
                    _split.call(this, section, direction * -1 + 1, true);
                }
                return;
            }

            border = direction ?
                    x1 + this.minDelta + Math.floor(Math.random() * (delta - this.minDelta * 2 - this.wallWidth * 2 + this.pathWidth)) + this.wallWidth :
                    y1 + this.minDelta + Math.floor(Math.random() * (delta - this.minDelta * 2 - this.wallWidth * 2 + this.pathWidth)) + this.wallWidth;
            if (direction) {
                section.rect.change(x1, y1, border - this.wallWidth - 1, y2);
                newSection = new NS.Section(new NS.Rect(border + this.wallWidth + this.pathWidth, y1, x2, y2));
            } else {
                section.rect.change(x1, y1, x2, border - this.wallWidth - 1);
                newSection = new NS.Section(new NS.Rect(x1, border + this.wallWidth + this.pathWidth, x2, y2));
            }

            // 今までのpathの更新
            for (i = 0; i < this.paths.length; i++) {
                path = this.paths[i];
                if (path.section1 === section) {
                    if (path.direction === direction) {
                        path.section1 = newSection; //つなぎ変え
                    } else if (Math.random() < this.addPathProb) {
                        //path追加
                        this.paths.push(new NS.Path(newSection, path.section2, path.direction));
                    }
                } else if (path.section2 === section && path.direction !== direction
                        && Math.random() < this.addPathProb) {
                    //path追加
                    this.paths.push(new NS.Path(path.section1, newSection, path.direction));
                }
            }

            // 新しいpathの生成
            path = new NS.Path(section, newSection, direction);
            this.paths.push(path);
            _split.call(this, section, Math.floor(Math.random() * 2), false);
            _split.call(this, newSection, Math.floor(Math.random() * 2), false);
        }
        /**
         * dataとcolDataをrectで指定した範囲の値をvにする
         * 
         * @param {Rect} rect 指定範囲
         * @param {int} img 代入する画像値
         * @param {int} hit 代入するヒット値
         * @returns {undefined}
         */
        var _fill = function(rect, img, hit) {
            for (var i = rect.y1; i <= rect.y2; i++) {
                for (var j = rect.x1; j <= rect.x2; j++) {
                    this.data[i][j] = img;
                    this.colData[i][j] = hit;
                }
            }
        }
        var _drawPath = function(path) {
            var s1 = path.section1
                    , s2 = path.section2
                    , exit1, exit2, relay
                    ;
            if (path.direction) { //横
                relay = s1.rect.x2 + this.wallWidth + this.pathWidth - 1; //縦につなぐ座標

                // s1から右の出口がなければ生成
                if (typeof s1.exits[1] === 'undefined') {
                    exit1 = s1.room.y1 + this.pathWidth + Math.floor(Math.random() * (s1.room.y2 - s1.room.y1 - this.pathWidth * 2));
                    _fill.call(this, new NS.Rect(s1.room.x2 + 1, exit1, relay, exit1 + this.pathWidth - 1), LOAD, 0);
                    s1.exits[1] = exit1;
                } else {
                    exit1 = s1.exits[1];
                }

                if (typeof s2.exits[3] === 'undefined') {
                    exit2 = s2.room.y1 + this.pathWidth + Math.floor(Math.random() * (s2.room.y2 - s2.room.y1 - this.pathWidth * 2));
                    _fill.call(this, new NS.Rect(relay - 1 + this.pathWidth, exit2, s2.room.x1 - 1, exit2 + this.pathWidth - 1), LOAD, 0);
                    s2.exits[3] = exit2;
                } else {
                    exit2 = s2.exits[3];
                }

                if (exit1 < exit2) {
                    _fill.call(this, new NS.Rect(relay, exit1, relay - 1 + this.pathWidth, exit2 + this.pathWidth - 1), LOAD, 0);
                } else {
                    _fill.call(this, new NS.Rect(relay, exit2, relay - 1 + this.pathWidth, exit1 + this.pathWidth - 1), LOAD, 0);
                }
            } else { //縦
                relay = s1.rect.y2 + this.wallWidth + this.pathWidth - 1;
                if (typeof s1.exits[0] === 'undefined') {
                    exit1 = s1.room.x1 + this.pathWidth + Math.floor(Math.random() * (s1.room.x2 - s1.room.x1 - this.pathWidth * 2));
                    _fill.call(this, new NS.Rect(exit1, s1.room.y2 + 1, exit1 + this.pathWidth - 1, relay), LOAD, 0);
                    s1.exits[0] = exit1;
                } else {
                    exit1 = s1.exits[0];
                }
                if (typeof s2.exits[2] === 'undefined') {
                    exit2 = s2.room.x1 + this.pathWidth + Math.floor(Math.random() * (s2.room.x2 - s2.room.x1 - this.pathWidth * 2));
                    _fill.call(this, new NS.Rect(exit2, relay - 1 + this.pathWidth, exit2 + this.pathWidth - 1, s2.room.y1 - 1), LOAD, 0);
                    s2.exits[2] = exit2;
                } else {
                    exit2 = s2.exits[2];
                }

                if (exit1 < exit2) {
                    _fill.call(this, new NS.Rect(exit1, relay, exit2 + this.pathWidth - 1, relay - 1 + this.pathWidth), LOAD, 0);
                } else {
                    _fill.call(this, new NS.Rect(exit2, relay, exit1 + this.pathWidth - 1, relay - 1 + this.pathWidth), LOAD, 0);
                }
            }
        }
        /**
         * targetにマップを描き出す (Debug用)
         * 
         * @param {jQueryObject} target
         * @returns {undefined}
         */
        MapData.prototype.print = function(target) {
            var row, text, i, j;
            for (i = 0; i < this.data.length; i++) {
                text = '';
                row = this.data[i];
                for (j = 0; j < row.length; j++) {
                    text += row[j];
                }
                target.append(text + '<br>');
            }
        }
        /**
         * 迷路を生成する
         * 
         * @returns {undefined}
         */
        MapData.prototype.make = function() {
            var i;

            // 初期化
            _fill.call(this, new NS.Rect(0, 0, this.width - 1, this.height - 1), WALL, 1);
            this.sections = new Array();
            this.paths = new Array();

            // 分割
            _split.call(this, new NS.Section(new NS.Rect(this.wallWidth, this.wallWidth, this.width - this.wallWidth - 1, this.height - this.wallWidth - 1)), Math.floor(Math.random() * 2), false);

            // pathの生成
            for (i = 0; i < this.paths.length; i++) {
                _drawPath.call(this, this.paths[i]);
            }
        }
        return MapData;
    })();
    NS.Rect = (function() {
        function Rect(x1, y1, x2, y2) {
            this.x1 = x1;
            this.y1 = y1;
            this.x2 = x2;
            this.y2 = y2;
        }

        Rect.prototype.change = function(x1, y1, x2, y2) {
            this.x1 = x1;
            this.y1 = y1;
            this.x2 = x2;
            this.y2 = y2;
        }

        return Rect;
    })();
    NS.Path = (function() {
        function Path(s1, s2, d) {
            this.section1 = s1;
            this.section2 = s2;
            this.direction = d; //0:縦 1:横
        }

        return Path;
    })();
    NS.Section = (function() {
        function Section(r) {
            this.rect = r;
            this.room;
            this.exits = new Array(4); //下右上左
        }

        Section.prototype.makeRoom = function(minDelta) {
            var width = minDelta + Math.floor(Math.random() * (this.rect.x2 - this.rect.x1 - minDelta))
                    , height = minDelta + Math.floor(Math.random() * (this.rect.y2 - this.rect.y1 - minDelta))
                    , x1 = this.rect.x1 + Math.floor(Math.random() * (this.rect.x2 - this.rect.x1 - width))
                    , y1 = this.rect.y1 + Math.floor(Math.random() * (this.rect.y2 - this.rect.y1 - height))
                    ;
            this.room = new NS.Rect(x1, y1, x1 + width, y1 + height);
        }
        Section.prototype.addExit = function(section, direction, n) {
            this.exit[direction] = n;
        }

        return Section;
    })();
    NS.Obj = (function() {
        /**
         * フィールド上に存在するものを表すクラス
         */
        function Obj() {
            this.x = 0;
            this.y = 0;
            this.dirx = 0;
            this.diry = 1;
            this.width = 32;
            this.height = 32;
            this.node;
            this.name;
            this.floor;
        }

        /**
         * オブジェを引数の分だけ移動させる
         * 
         * @param {int} dx x方向の移動距離
         * @param {int} dy y方向の移動距離
         * @param {NS.Floor} floor 現在のFloor
         * @returns {boolean} ret 移動成功かどうか
         */
        Obj.prototype.move = function(dx, dy) {
            var x = this.x + dx;
            var y = this.y + dy;
            var maxX;
            var maxY;
            var ret = true;

            if (!this.floor) return false;
            
            if (dx !== 0) { 
                this.dirx = dx / Math.abs(dx);
            } else {
                this.dirx = 0;
            }
            if (dy !== 0) {
                this.diry = dy / Math.abs(dy);
            } else {
                this.diry = 0;
            }

            maxX = (this.floor.mapData.width - 1) * PX;
            maxY = (this.floor.mapData.height - 1) * PX;

            if (x < 0) x = 0;
            if (maxX <= x) x = maxX;
            if (y < 0) y = 0;
            if (maxY < y) y = maxY;

            if (this.x === x && this.y === y) {
                ret = false;
            }

            // 当たり判定
            if (!this.floor.isHit(this, x, y)) {
                this.x = x;
                this.y = y;
            } else {
                ret = false;
            }

            return ret;
        }
        Obj.prototype.view = function() {
            this.node.x = this.x;
            this.node.y = this.y;
        }

        return Obj;
    })();
    NS.Floor = (function() {
        var _super = NS.Obj;

        function Floor(game) {
            _super.call(this);

            this.number = 0;
            this.mapData = new NS.MapData();
            this.node = new Group();
            this.map = new Map(PX, PX);

            this.map.image = game.assets[MAP_FILE];
            this.next();
        }

        Floor.prototype = Object.create(_super.prototype);
        Floor.prototype.constructor = _super;

        /**
         * オブジェを追加する
         *  
         * @param {NS.Obj} obj 追加するオブジェ
         * @returns {undefined}
         */
        Floor.prototype.addChild = function(obj) {
            this.node.addChild(obj.node);
            obj.floor = this;
        }
        /**
         * 次の階へ行く
         * マップ作り直し
         *
         * @returns {undefined}
         */
        Floor.prototype.next = function() {
            this.number++;
            this.mapData.make();
            this.map.loadData(this.mapData.data);
            this.map.collisionData = this.mapData.colData;
        }
        /**
         * 引数のキャラを中心に描画
         *
         * @param {Charactor} obj
         * @param {Enchant.Game} game
         * @returns {undefined}
         */
        Floor.prototype.center = function(obj, game) {
            var x = game.width / 2 - obj.x;
            var y = game.height / 2 - obj.y;
            var minX = game.width - this.map.width;
            var minY = game.height - this.map.height;

            if (0 < x) x = 0;
            if (x < minX) x = minX;
            if (0 < y) y = 0;
            if (y < minY) y = minY;

            this.x = x;
            this.y = y;
        }

        /**
         * オブジェクトとmapの当たり判定を行う
         * 
         * @param {Obj} obj
         * @param {int} x
         * @param {int} y
         * * @returns {boolean}
         */
        Floor.prototype.isHit = function(obj, x, y) {
            if (x === undefined) x = obj.x;
            if (y === undefined) y = obj.y;

            if (this.map.hitTest(x, y)
                    || this.map.hitTest(x + obj.width, y) 
                    || this.map.hitTest(x, y + obj.height)
                    || this.map.hitTest(x + obj.width, y + obj.height)) {
                return true;
            } else {
                return false;
            }
        }

        return Floor;
    })();
    NS.Charactor = (function() {
        var _super = NS.Obj;

        function Charactor() {
            _super.call(this);

            this.maxHp;
            this.maxMp;
            this.hp;
            this.mp;
            this.speed = 5;
            this.skills;
            this.states = [];
        }

        Charactor.prototype = Object.create(_super.prototype);
        Charactor.prototype.constructor = _super;

        /**
         * 
         * @param {int} dx
         * @param {int} dy
         * @returns {undefined}
         */
        Charactor.prototype.move = function(dx, dy) {
            var i;
            for (i = 0; i < this.speed; i++) {
                if (!_super.prototype.move.call(this, dx, dy))
                    break;
            }
        }

        return Charactor;
    })();
    NS.Hero = (function() {
        var _super = NS.Charactor;

        function Hero(game) {
            var sprite;
            _super.call(this);

            sprite = new Sprite(PX, PX);
            sprite.image = game.assets['img/chara0.png'];
            sprite.frame = [0, 1];

            this.node = sprite;
            this.maxHp = 200;
            this.maxMp = 50;
            this.skills = [
                {
                    command: ['z', 'x'],
                    state: NS.dash,
                },
            ];
            this.keys = new Array();

            this.hp = this.maxHp;
            this.mp = this.maxMp;
        }

        Hero.prototype = Object.create(_super.prototype);
        Hero.prototype.constructor = _super;

        /**
         * 
         * @param {Key} key
         * @param {Floor} floor
         * @returns {undefined}
         */
        Hero.prototype.update = function(key, floor) {
            var prevent = false, dir = [0,0];
            this.states.forEach(function(val, index, arr) {
                prevent = prevent || val.prevent;
                if (!val.update(this, floor)) {
                    arr.splice(index, 1);
                }
            }, this);

            if (prevent) return;

            if (key.get('left')) {
                dir[0]--;
            }
            if (key.get('right')) {
                dir[0]++;
            }
            if (key.get('up')) {
                dir[1]--;
            }
            if (key.get('down')) {
                dir[1]++;
            }
            if (dir[0] !==0 || dir[1] !== 0) {
                this.move(dir[0], dir[1]);
            }
            if (key.get('z')) {
                console.log('z');
                floor.next();
            }
            if (key.get('x')) {
                console.log('x');
                this.states.push(new NS.Dash(this));
            }
            if (key.get('a')) {
                console.log('a');
            }
            if (key.get('s')) {
                console.log('s');
            }

            //_super.prototype.update.call(this);
        }

        return Hero;
    })();
    NS.State = (function() {
        /**
         * キャラクタの特殊状態を表すクラス
         */
        function State() {
            this.live; // 生存フレーム
            this.time = this.live; // 現在のフレーム
            this.pre = 0; // 発生フレーム
            this.end = 0; // 硬直フレーム
            this.prevent = false; // キャラのキー操作を妨げるか
        }

        /**
         * 
         * @retrun {boolean} 
         */
        State.prototype.update = function() {
            if (this.live - this.time >= this.pre || this.time > this.end) {
                this.effect();
            }
            return --this.time > 0;
        };

        return State;
    })();
    NS.Dash = (function() {
        var _super = NS.State;
        /**
         * ダッシュ
         * @param {Charactor} owner
         */
        function Dash(owner) {
            this.live = 14;
            _super.call(this);

            this.pre = 2;
            this.end = 2;
            this.prevent = true;
            this.owner = owner;
        }

        Dash.prototype = Object.create(_super.prototype);
        Dash.prototype.constructor = _super;

        Dash.prototype.effect = function() {
            this.owner.move(this.owner.dirx * 3, this.owner.diry * 3);
        }

        return Dash;
    })();
})(ABCD);
