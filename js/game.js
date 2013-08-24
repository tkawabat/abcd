(function(ABCD) {
    enchant();

    var game = ABCD.initialize();
    var key = new ABCD.Key(new Array(
        {name: 'left', once: false, number: 37}
    , {name: 'right', once: false, number: 39}
    , {name: 'up', once: false, number: 38}
    , {name: 'down', once: false, number: 40}
    , {name: 'z', once: true}
    , {name: 'x', once: true}
    , {name: 'a', once: true}
    , {name: 's', once: true}
    ), game);

    game.onload = function() {
         var floor = new ABCD.Floor(game);
       
        var hero2 = new ABCD.Hero(game);
        hero2.x = 20 * 32;
        hero2.y = 22 * 32;
        var hero = new ABCD.Hero(game);
        hero.x = 12 * 32;
        hero.y = 12 * 32;
        


        var enemy = new ABCD.Charactor();
        var sprite = new Sprite(32, 32);
        sprite.image = game.assets['img/chara0.png'];
        sprite.frame = [7, 8];
        enemy.node = sprite;
        enemy.x = 20 * 32;
        enemy.y = 20 * 32;

        floor.node.addChild(floor.map);
        floor.addChild(hero);
        floor.addChild(hero2);
       
        floor.addChild(enemy);
        game.rootScene.addChild(floor.node);
         
        var label = new Label('hoge');
        label.font = "28px Palatino";
        label.x = game.width - 28*4;
        label.y = game.height - 28;//label.height;
        game.rootScene.addChild(label);

        game.addEventListener('enterframe', function() {
            hero.update(key, floor);
            floor.center(hero, game);
            
            //enemy.update();
            key.reset();
            
            label.text = 'x='+hero.dirx+', y='+hero.diry+', x='+hero.node.x+', y='+hero.node.y;
            hero.view(); 
            enemy.view();
            hero2.view();
            
            floor.view();

        });       
    }

    game.start();
})(ABCD);
