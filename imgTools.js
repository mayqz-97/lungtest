/**
 * 显示和操作影像的相关函数
 */
layui.define(['jquery','slider','initcornerstone','changeLayout'],function (exports) {
    window.dicomFileData = []; // 将dicomFileData设为全局变量


    var $ = layui.$,
    slider = layui.slider,
    initcornerstone = layui.initcornerstone,
    changeLayout = layui.changeLayout;

    window.showOriginalImage = false;

    var measureTools = ['Angle','ArrowAnnotate','Bidirectional','CobbAngle','Elliptical','FreehandRoi','Length','Probe','Rectangle','TextMarker','Wwwc','Magnify','Ctr'];
    
    // 新增：用于存储DICOM文件数据的全局变量
    var dicomFileData = [];

    //工具加载池
    var catchTool = {}

    //当前选中工具
    var currentToolName;

    //元素滑块数组
    var sliderArr = {};

    //序列布局DOM元素集合elementsArr变量
    var seriesElementsArr = [];

    //缩略图个数
    var studyElementsNumr = 0;
    //缩略图加载索引用于关闭加载动画
    var studyLoadIndex = 0;

    //接受加载层对象
    var layerObj;
    //获取加载层
    function initLayerClose(layer){
        layerObj = layer;
    }

    //鼠标滚轮同步对象
    var stackImageIndexSynchronizer = new cornerstoneTools.Synchronizer(
        'cornerstoneimagerendered',
        cornerstoneTools.stackImageIndexSynchronizer
      );
    var panZoomSynchronizer = new cornerstoneTools.Synchronizer(
        'cornerstoneimagerendered',
        cornerstoneTools.panZoomSynchronizer
    );
    var wwwcSynchronizer = new cornerstoneTools.Synchronizer(
        'cornerstoneimagerendered',
        cornerstoneTools.wwwcSynchronizer
    );

    var referenceLineSynchronizer = new cornerstoneTools.Synchronizer(
        'cornerstonenewimage',
        cornerstoneTools.updateImageSynchronizer
    );
    var enableSetTools = {'ReferenceLines':referenceLineSynchronizer};
    /**
     * 显示左侧缩略图函数-支持布局
     * @param divId 父DOM元素id
     * @param series 序列数
     */
    function renderStudyImg(divId,series){
        if(!divId || !series){
            return;
        }
        //渲染检查序列缩略图
        changeLayout.renderStudyLayout(divId,series.length);
        studyElementsNumr = series.length;
        var elements = $('#'+divId).find('.indeximgcontent');
        for (let i = 0; i < elements.length; i++) {
            let element = elements[i];
            //$(element).data('studysort',i);
            cornerstone.enable(element);
            initcornerstone.loadAndCacheImagePlus(series[i].imageIds[0],{ seriesId:  i,totalNums: series[i].imageIds.length}).then(function(image) {
                //console.log(series[i].currentImageIdIndex);
                studyLoadIndex++;
                if(studyLoadIndex == studyElementsNumr){
                        layer.close(layerObj)
                }
                cornerstone.displayImage(element, image);
                cornerstone.reset(element);
                cornerstone.resize(element);
            });
            //移除所有监听事件，使缩略图列表能滚动
            cornerstone.triggerEvent(cornerstone.events,'cornerstoneelementdisabled',{element});
            
            //添加拖拽效果
            $(element).draggable({
                appendTo: 'body',
                //containment:'body',
                scroll: false ,
                helper:function () {
                    // let imgCanvas = $(this).children().get(0);
                    // var $domClone =$(this).clone(true);
                    // var newCanvas = $($domClone).children().get(0);
                    // $(newCanvas).css('z-index',999);
                    // var context = newCanvas.getContext('2d');
                    // context.drawImage(imgCanvas,0,0);
                    // return $domClone;
                    var imgCanvas = this.children[0];
                    var domClone =this.cloneNode(true);
                    var newCanvas = domClone.children[0];
                    var context = newCanvas.getContext('2d');
                    context.drawImage(imgCanvas,0,0);
                    $(domClone).css('z-index',999);
                    return $(domClone);
                }
            });
            
            //序列缩略图添加双击事件
            $(element).dblclick(function(event){
                //console.log($('.seriesborder-primary-light'))
                if($('.seriesborder-primary-light').length>0){
                    let seriesDiv =  $('.seriesborder-primary-light').get(0);
                    let index = $(this).attr('seriesNum');
                    //如果为相同序列返回
                    if(index == $(seriesDiv).data('seriesSort')){
                        return;
                    }
                    //判断多序列显示，还是单序列显示
                    if($(seriesDiv).data('oneseriesflag')){
                        //获取显示序列的div容器
                        let elements = $('.seriescontent');
                        let divNums = elements.length;
                        let seriesarr = series[index];
                        let stacks = oneSeriesRebuildDataArr(elements,divNums,seriesarr);
                        
                        //加载单序列图像
                        oneseriesLoad(elements,stacks,divNums,index);
                    }else{
                       
                        $(seriesDiv).data('seriesSort',index);
                        loadStackScroll(series[index],seriesDiv);
                        // if($(seriesDiv).find('canvas').length>0){
                        //     //cornerstone.disable(seriesDiv);
                        //     //console.log(cornerstone.getEnabledElement(seriesDiv))
                        //     cornerstone.disable(seriesDiv);
                        //     cornerstone.enable(seriesDiv);
                        //     loadStackScroll(series[index],seriesDiv);
                        //     //cornerstone.reset(seriesDiv);
                        // }else{
                        //     cornerstone.enable(seriesDiv);
                        //     loadStackScroll(series[index],seriesDiv);
                        // }
                    }

                    
                }
                //渲染缩略图高亮
                renderLightStudy();
            });

        }
       
    }

    /**
     * 显示并加载各个序列影像的函数-支持布局
     * @param divId 父DOM元素id
     * @param series  检查影像数据
     * @param rows  行数
     * @param cols  列数
     */
    function renderSeriesImg(divId,series,rows,cols){
        if(!divId || !series){
            return;
        }
        //渲染序列布局
        changeLayout.renderSeriesLayout(divId,rows,cols);

        rows = Number(rows);
        cols = Number(cols);

        //layui滑动对象数组
        let sliderObjArr = [];

        
        //获取显示序列的div容器
        let elements = $('#'+divId).children();

        //添加拖拽接受事件
        eventDroppable(elements,series)
          //先移除之前的element
          removeOldEnableElement();
        
        //复制给全局变量
        seriesElementsArr = elements;
       

        let num = series.length>elements.length?elements.length:series.length;
        if(elements.length<1){
            return;
        }
        //使enable的element清空
        //cornerstone.getEnabledElements() = [];
        //清空参考同步
        referenceLineSynchronizer.destroy();
        catchTool['ReferenceLines'] = false;
        for (let i = 0; i < num; i++) {
            let element = elements[i];
            //console.log(series[i].imageIds)
            $(element).data('seriesSort',i);
            //console.log(series[i])
           

            //cornerstone.enable(element);
            loadStackScroll(series[i],element);
            //鼠标双击事件
            dbclickevent(element,rows*cols);

            //添加参考线
            referenceLineSynchronizer.add(element);
            if(i==0){
                $(element).addClass('seriesborder-primary-light');
            }
        }


        //图片渲染事件
        oneseriesrenderedevent(elements,series);

        //渲染缩略图高亮
        renderLightStudy();
        //全局定义
        //   let apiTool = cornerstoneTools['StackScrollMouseWheelTool'];
        //   cornerstoneTools.addTool(apiTool);
        //   cornerstoneTools.setToolActive('StackScrollMouseWheel', { mouseButtonMask: 1 });
    }

    /**
     * 显示并加载单个序列影像多图像显示的函数
     */
    function renderOneseriesImg(divId,series,rows,cols){

        rows = Number(rows);
        cols = Number(cols);
        //获取选中的div框
        let seriesElement = $('.studyborder-primary-light').get(0);
        if($(seriesElement).find("canvas").length<1){
            return;
        }

        let seriesSort = $(seriesElement).attr('seriesNum');

        //渲染序列布局
        changeLayout.renderSeriesLayout(divId,rows,cols);

        
        let divNums = rows*cols;
        let seriesarr = series[seriesSort];
        //获取显示序列的div容器
        let elements = $('#'+divId).children();


         //添加拖拽接受事件
         eventOneSeriesDroppable(elements,series);

        //先移除之前的element
        removeOldEnableElement();
        
        //复制给全局变量
        seriesElementsArr = elements;
        let stacks = oneSeriesRebuildDataArr(elements,divNums,seriesarr);
        
        //加载单序列图像
        oneseriesLoad(elements,stacks,divNums,seriesSort);

        //图片渲染事件
        oneimagerenderedevent(elements,series);

        //渲染缩略图高亮
        renderLightStudy();
        // cornerstoneTools.setToolActive('StackScrollMouseWheel', {
        //     mouseButtonMask: 1,
        //     synchronizationContext: stackImageIndexSynchronizer,
        //   });


    }

    //获取但序列展示重组数据
    function oneSeriesRebuildDataArr(elements,divNums,seriesarr){
         //一共有几页
         let pageNum = Math.ceil(seriesarr.imageIds.length/divNums);
         //oneSereiesImgStacks =[];
         let stacks = [];
        _.forEach(elements, (item) => {
             //是否结尾为黑图重置为false
            $(item).data('noendImg',false);
            //单序列显示时的序列图像总数
            $(item).data('seiresImgNums',seriesarr.imageIds.length);
        })  
        
         //将一个序列进行重组来进行多张图片同步显示
         for(var i=0;i<divNums;i++){
             let arr = [];
             for(var j=0;j<pageNum;j++){
                 if(j*divNums+i<seriesarr.imageIds.length){
                     arr.push(seriesarr.imageIds[i+divNums*j]);
                 }else{
                     //arr.push("example-n://:#000000");
                     $(elements[i]).data('noendImg',true);
                     arr.push(seriesarr.imageIds[seriesarr.imageIds.length-1]);
                 }
             } 
             stacks.push({
                 currentImageIdIndex: 0,
                 imageIds: arr,
             });
         }

         return stacks
    }

    //单组序列多块图像展示加载
    function oneseriesLoad(elements,stacks,divNums,seriesSort){
        if(elements.length<1){
            return;
        }
        for (let i = 0; i < elements.length; i++) {
            //添加标识用于判断是多序列显示还是单序列显示
            $(elements[i]).data('oneseriesflag',true);
            $(elements[i]).data('seriesSort',seriesSort);
            //cornerstone.enable(elements[i]);
            loadStackScroll(stacks[i],elements[i]);
             //鼠标双击事件
             dbclickevent(elements[i],divNums)

           
             if(i==0){
                $(elements[i]).addClass('seriesborder-primary-light');
            }
        }
        /**清除所有旧element */
        stackImageIndexSynchronizer.destroy();
        panZoomSynchronizer.destroy();
        wwwcSynchronizer.destroy();

        _.forEach(elements, (item) => {
            stackImageIndexSynchronizer.add(item);
            panZoomSynchronizer.add(item);
            wwwcSynchronizer.add(item);
            stackImageIndexSynchronizer.enabled = true;
            
        });
    }

    //鼠标滚动事件
    function wheelEven(e){
        cornerstoneTools.getElementToolStateManager(e.target)
        let element = e.target;
        let stackToolDataSource = cornerstoneTools.getToolState(element, 'stack');
        let stackData = stackToolDataSource.data[0];
    }

    /**
     * 添加拖拽接受事件
     * @param elements 父DOM元素id
     * @param series  检查影像数据
     */
    function eventDroppable(elements,series){
        //获取显示序列的div容器
        //var eleements = $('#'+divId).children();
        if(elements.length<1){
            return;
        };
        _.forEach(elements, (item) => {
            $(item).droppable({
                drop: function( event, ui ) {
                    //console.log(cornerstone.getEnabledElement(this) );
                    let index = $(ui.draggable).attr('seriesNum');
                    //如果为相同序列返回
                    if(index == $(this).data('seriesSort')){
                        return;
                    }
                    $(this).data('seriesSort',index);
                    loadStackScroll(series[index],this);
                    // if($(this).find('canvas').length>0){
                    //     loadStackScroll(series[index],this);
                    //     //cornerstone.reset(this);
                    // }else{
                    //     cornerstone.enable(this);
                    //     loadStackScroll(series[index],this);
                        
                    //     //cornerstone.reset(this);
                    // }
                    
                    //渲染缩略图高亮
                    renderLightStudy();
                }
                });

                
        });
        
    }

    /**
     * 单个序列展示时添加拖拽接受事件
     * @param elements 父DOM元素
     * @param series  检查影像数据
     */
    function eventOneSeriesDroppable(elements,series){
        //获取显示序列的div容器
        //var elements = $('#'+divId).children();
        if(elements.length<1){
            return;
        };
        _.forEach(elements, (item) => {
            $(item).droppable({
                drop: function( event, ui ) {
                    //console.log(cornerstone.getEnabledElement(this) );
                    let index = $(ui.draggable).attr('seriesNum');

                    //如果为相同序列返回
                    if(index == $(this).data('seriesSort')){
                        return;
                    }
                    $(this).data('seriesSort',index);

                    $(this).siblings().data('seriesSort',index);

                    //获取显示序列的div容器
                    let divNums = elements.length;
                    let seriesarr = series[index];
                    let stacks = oneSeriesRebuildDataArr(elements,divNums,seriesarr);

                    //加载单序列图像
                    oneseriesLoad(elements,stacks,divNums);
                   
                    //渲染缩略图高亮
                    renderLightStudy();
                }
              });

             
        });
    }


    //多个序列图片布局图片渲染事件
    function oneseriesrenderedevent(elements,series){
        //获取显示序列的div容器
        if(elements.length<1){
            return;
        };
        //.log('111111');
        _.forEach(elements, (item) => {
            //console.log('22222');
            //$(item).off('cornerstoneimagerendered');
            //禁止鼠标右键弹系统默认菜单
            item.oncontextmenu = function(){return false;};

            $(item).on('cornerstoneimagerendered',function(e){
                //console.log('3333');
                let element = item;
                let eventData = e.detail;
                let stackData = cornerstoneTools.getToolState(element, 'stack');
                //console.log(stackData);
                if (!stackData || !stackData.data || !stackData.data.length) {
                    return;
                    }
                    
                let stack = stackData.data[0];
                //获取元素下标
                let laocalIndex = $(element).index();
                //console.log(stack.imageIds.length,stack.currentImageIdIndex)
                //console.log(stack.imageIds.length-stack.currentImageIdIndex-1)
                //更新滑块数值
                sliderArr['slider'+laocalIndex].setValue(stack.imageIds.length-stack.currentImageIdIndex-1);
                $(element).find('.layui-slider-vertical').css('height', $(element).height()-50);
                //console.log(stack.imageIds[stack.currentImageIdIndex]);
                //渲染注记文字
                renderContentText(element,eventData,stack,1);
                //console.log('4444');
            })

                
        });
    }

    //单序图片布局展示图片渲染事件
    function oneimagerenderedevent(elements,series){
        //获取显示序列的div容器
        if(elements.length<1){
            return;
        };
       
        _.forEach(elements, (item) => {
            //禁止鼠标右键弹系统默认菜单
            item.oncontextmenu = function(){return false;};

            $(item).on('cornerstoneimagerendered',function(e){
                
                let element = item;
                let eventData = e.detail;
                let stackData = cornerstoneTools.getToolState(element, 'stack');
                //console.log(stackData);
                if (!stackData || !stackData.data || !stackData.data.length) {
                    return;
                  }
                
                let stack = stackData.data[0];
                //console.log(stack.imageIds[stack.currentImageIdIndex]);
                //判断最后一张为纯黑色
                if($(item).data('noendImg')&&stack.imageIds.length== (stack.currentImageIdIndex+1)){
                    let elecanvas = $(element).find('canvas').get(0);
                    elecanvas.width = elecanvas.width;
                    //渲染注记文字
                    
                    renderContentText(element,eventData,stack,0);
                }else{
                    //渲染注记文字
                    renderContentText(element,eventData,stack,2);
                }
            })

             
        });
    }

    //渲染四个角的文字信息
    function renderContentText(element,eventData,stack,showFlag){
        //console.log(eventData.viewport.rotation);
        //showFlag  1:为多序列 2：为单序列 0:黑色
        let markers = getOrientationMarkers(element,eventData);
        //console.log(markers,eventData)


        if(showFlag == 1 && markers){
            $(element).find('.topleft').empty().html('Study Date：'+strIsNullOrEmpty(eventData.image.data.string('x00080020')) + '<br/>'+ 'StudyID：' + strIsNullOrEmpty(eventData.image.data.string('x00200010')) + '<br/>' +'Series Number：' + strIsNullOrEmpty(eventData.image.data.string('x00200011')));
            $(element).find('.topright').empty().html('Name：' + strIsNullOrEmpty(eventData.image.data.string('x00100010')) + '<br/>' +'PID：' + strIsNullOrEmpty(eventData.image.data.string('x00100020')) + '<br/>' +'Sex：' + strIsNullOrEmpty(eventData.image.data.string('x00100040')));
            $(element).find('.bottomright').empty().html('SliceThickness：'+strIsNullOrEmpty(eventData.image.data.string('x00180050'))+'<br/>'+ 'Zoom：' + strIsNullOrEmpty(eventData.viewport.scale.toFixed(2)));
            $(element).find('.bottomleft').empty().html('instanceNumber：'+strIsNullOrEmpty(eventData.image.data.string('x00200013'))+'<br/>'+'Img：'+(stack.currentImageIdIndex+1)+'/'+stack.imageIds.length+'<br/>'+'WW/WC：' + strIsNullOrEmpty(Math.round(eventData.viewport.voi.windowWidth)) + '/' + strIsNullOrEmpty(Math.round(eventData.viewport.voi.windowCenter))+'<br/>'+'SliceLocation：'+strIsNullOrEmpty(eventData.image.data.string('x00201041')));
            $(element).find('.top').empty().html(strIsNullOrEmpty(markers.top));
            $(element).find('.left').empty().html(strIsNullOrEmpty(markers.left));
            $(element).find('.right').empty().html(strIsNullOrEmpty(markers.right));
            $(element).find('.bottom').empty().html(strIsNullOrEmpty(markers.bottom));
            if (!window.showOriginalImage && eventData.image && eventData.image.data && eventData.image.data.string) {
                
                const instanceNumber = eventData.image.data.string('x00200013');
                if (instanceNumber) {
                    const fileData = findFileDataByInstanceNumber(instanceNumber);
                    if (fileData && fileData.x_min && fileData.y_min && fileData.x_max && fileData.y_max) {
                        console.log('Calling drawBoundingBox for instance:', instanceNumber);
                        drawBoundingBox(element, fileData, eventData);
                    } else {
                        console.log('No bounding box data for instance number:', instanceNumber);
                    }
                } else {
                    console.log('No instance number found in DICOM data');
                }
            } else {
                console.log('Invalid eventData structure');
            }
            


        }else if(showFlag == 2 && markers){
            //let markers = getOrientationMarkers(element,eventData);
            let divNums = $(element).siblings().length+1;
            let laocalIndex = $(element).index();
            let seiresImgNums = $(element).data('seiresImgNums');
            $(element).find('.topleft').empty().html('Study Date：'+strIsNullOrEmpty(eventData.image.data.string('x00080020')) + '<br/>'+ 'StudyID：' + strIsNullOrEmpty(eventData.image.data.string('x00200010')) + '<br/>' +'Series Number：' + strIsNullOrEmpty(eventData.image.data.string('x00200011')));
            $(element).find('.topright').empty().html('Name：' + strIsNullOrEmpty(eventData.image.data.string('x00100010')) + '<br/>' +'PID：' + strIsNullOrEmpty(eventData.image.data.string('x00100020')) + '<br/>' +'Sex：' + strIsNullOrEmpty(eventData.image.data.string('x00100040')));
            $(element).find('.bottomright').empty().html( 'Zoom：' + strIsNullOrEmpty(eventData.viewport.scale.toFixed(2)));
            $(element).find('.bottomleft').empty().html('Img：'+(stack.currentImageIdIndex*divNums+laocalIndex+1)+'/'+seiresImgNums+'<br/>'+'WW/WC：' + strIsNullOrEmpty(Math.round(eventData.viewport.voi.windowWidth)) + '/' + strIsNullOrEmpty(Math.round(eventData.viewport.voi.windowCenter)));
            $(element).find('.top').empty().html(strIsNullOrEmpty(markers.top));
            $(element).find('.left').empty().html(strIsNullOrEmpty(markers.left));
            $(element).find('.right').empty().html(strIsNullOrEmpty(markers.right));
            $(element).find('.bottom').empty().html(strIsNullOrEmpty(markers.bottom));
           
            if (!window.showOriginalImage && eventData.image && eventData.image.data && eventData.image.data.string) {
                
                const instanceNumber = eventData.image.data.string('x00200013');
                if (instanceNumber) {
                    const fileData = findFileDataByInstanceNumber(instanceNumber);
                    if (fileData && fileData.x_min && fileData.y_min && fileData.x_max && fileData.y_max) {
                        console.log('Calling drawBoundingBox for instance:', instanceNumber);
                        drawBoundingBox(element, fileData, eventData);
                    } else {
                        console.log('No bounding box data for instance number:', instanceNumber);
                    }
                } else {
                    console.log('No instance number found in DICOM data');
                }
            } else {
                console.log('Invalid eventData structure');
            }
        }else {
            
            $(element).find('.topleft').empty();
            $(element).find('.topright').empty();
            $(element).find('.bottomright').empty();
            $(element).find('.bottomleft').empty();
            $(element).find('.top').empty();
            $(element).find('.left').empty();
            $(element).find('.right').empty();
            $(element).find('.bottom').empty();
           
            if (!window.showOriginalImage && eventData.image && eventData.image.data && eventData.image.data.string) {
                
                const instanceNumber = eventData.image.data.string('x00200013');
                if (instanceNumber) {
                    const fileData = findFileDataByInstanceNumber(instanceNumber);
                    if (fileData && fileData.x_min && fileData.y_min && fileData.x_max && fileData.y_max) {
                        console.log('Calling drawBoundingBox for instance:', instanceNumber);
                        drawBoundingBox(element, fileData, eventData);
                    } else {
                        console.log('No bounding box data for instance number:', instanceNumber);
                    }
                } else {
                    console.log('No instance number found in DICOM data');
                }
            } else {
                console.log('Invalid eventData structure');
            }
        }
        
    }
    
    function findFileDataByInstanceNumber(instanceNumber) {
        const fileData = dicomFileData.find(file => {
            const fileName = file.fileName.split('.')[0]; // 移除文件扩展名
            return fileName === instanceNumber || fileName === instanceNumber.padStart(3, '0');
        });
        console.log('Instance Number:', instanceNumber, 'File Data:', fileData);
        return fileData;
    }

    function drawBoundingBox(element, fileData, eventData) {
        if (window.showOriginalImage) {
            return; // 如果显示原始图像，则不绘制边界框和文本
        }
    
        if (!fileData || !eventData || !eventData.image) {
            console.error('Missing fileData, eventData or image:', { fileData, eventData });
            return;
        }
    
        const imageData = eventData.image;
        const { columns, rows } = imageData;
    
        if (!columns || !rows) {
            console.error('Invalid image dimensions:', { columns, rows });
            return;
        }
    
        const pixelSpacing = eventData.image.data.string('x00280030');
        if (!pixelSpacing) {
            console.error('Pixel spacing information not available');
            return;
        }
    
        const [rowSpacing, colSpacing] = pixelSpacing.split('\\').map(Number);
    
        const topLeft = {
            x: parseInt(fileData.x_min),
            y: parseInt(fileData.y_min)
        };
        const bottomRight = {
            x: parseInt(fileData.x_max),
            y: parseInt(fileData.y_max)
        };
    
        const width = (bottomRight.x - topLeft.x) * colSpacing;
        const height = (bottomRight.y - topLeft.y) * rowSpacing;
    
        const ctx = element.querySelector('canvas').getContext('2d');
        
        ctx.save();
        
        // 绘制边界框
        ctx.beginPath();
        ctx.rect(topLeft.x, topLeft.y, 
            bottomRight.x - topLeft.x, 
            bottomRight.y - topLeft.y);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.stroke();
    
        // 添加恶性度等级文字和尺寸信息
        if (fileData.malignancy !== undefined) {
            ctx.font = '16px Arial';
            ctx.fillStyle = 'red';
            const malignancyText = `恶性度等级：${fileData.malignancy}`;
            const sizeText = `${width.toFixed(1)}*${height.toFixed(1)}mm`;
            const textWidth = Math.max(ctx.measureText(malignancyText).width, ctx.measureText(sizeText).width);
            const textX = columns / 2 - textWidth / 2; // 图片宽度的中间
            const malignancyY = 40; // 距离顶部40像素
            const sizeY = 60; // 恶性度文字下方20像素
            
            // 绘制半透明背景
            // ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            // ctx.fillRect(0, 0, columns, 70);
            
            // 绘制恶性度等级文字
            ctx.fillStyle = 'red';
            ctx.fillText(malignancyText, textX, malignancyY);
            
            // 绘制尺寸信息
            ctx.fillText(sizeText, textX, sizeY);
        }
    
        // 添加置信度信息
        if (fileData.conf !== undefined) {
            ctx.font = '14px Arial';
            ctx.fillStyle = 'yellow'; // 使用黄色以便于在红色边框上清晰可见
            const confText = `${parseFloat(fileData.conf).toFixed(2)}`;
            const confTextWidth = ctx.measureText(confText).width;
            const confTextX = bottomRight.x ; // 方框右上角的外面，右边界加上5像素的间距
            const confTextY = topLeft.y ; // 方框上边界减去10像素，使其位于方框的外面
            
            // 绘制半透明背景以增加可读性
            // ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            // ctx.fillRect(confTextX - 2, confTextY - 15, confTextWidth + 4, 20);
            
            // 绘制置信度文字
            ctx.fillStyle = 'yellow';
            ctx.fillText(confText, confTextX, confTextY);
        }
    
        ctx.restore();
    }

    //获取上下左右信息
    function getOrientationMarkers(element,eventData){
       
        let enabledElement = cornerstone.getEnabledElement(element);
        let imagePlane = cornerstone.metaData.get(
            'imagePlaneModule',
            enabledElement.image.imageId
        );

        if (!imagePlane || !imagePlane.rowCosines || !imagePlane.columnCosines) {
            return;
        }

        let row = cornerstoneTools.orientation.getOrientationString(imagePlane.rowCosines);
        let column = cornerstoneTools.orientation.getOrientationString(imagePlane.columnCosines);
        let oppositeRow = cornerstoneTools.orientation.invertOrientationString(row);
        let oppositeColumn = cornerstoneTools.orientation.invertOrientationString(column);

        let markers =  {
            top: oppositeColumn,
            bottom: column,
            left: oppositeRow,
            right: row,
        };
        switch(eventData.viewport.rotation ){
            case 90:
                markers =  {
                    top: oppositeRow,
                    bottom: row,
                    left: column,
                    right: oppositeColumn,
                };
                break;
            case 180:
                markers =  {
                    top: column,
                    bottom: oppositeColumn,
                    left: row,
                    right: oppositeRow,
                };
                break;
            case 270:
                markers =  {
                    top: row,
                    bottom: oppositeRow,
                    left: oppositeColumn,
                    right: column,
                };
                break;
            default:
                break;
        };
        if(eventData.viewport.vflip){
            let top = markers.top;
            markers.top =  markers.bottom;
            markers.bottom = top;
        }
        if(eventData.viewport.hflip){
            let right = markers.right;
            markers.right =  markers.left;
            markers.left = right;
        }
        
        return markers;
        
    }

    //清除之前旧的elements
    function removeOldEnableElement(){
        //先移除之前的element
        if(seriesElementsArr.length>0){
            _.forEach(seriesElementsArr,(item) => {
                cornerstone.disable(item);
            });
        }
        if(studyElementsNumr>0){
    
            cornerstone.getEnabledElements().splice(studyElementsNumr); 
        }

    }

    //判断是否为undefine null 或者其他
    function strIsNullOrEmpty(value){
        //正则表达式用于判斷字符串是否全部由空格或换行符组成
        var reg = /^\s*$/
        //返回值为true表示不是空字符串 
        if(value != null && value != undefined && !reg.test(value)){
            return value
        }else{
            return '';
        }
    }

    //序列框鼠标双击事件
    function dbclickevent(element,divNums){
        //序列狂添加双击事件
        $(element).dblclick(function(event){
            if($(this).find('canvas').length<1||(divNums)<2){
                return;
            }
            //判断放大还是缩小
            if($($(this).siblings('div').get(0)).is(":visible")){

                if(!$(this).data('positionInfo')){
                    $(this).data('positionInfo',{
                        'top':$(this).css('top'),
                        'left':$(this).css('left'),
                        'width':$(this).css('width'),
                        'height':$(this).css('height')
                    });
                }

                //隐藏其他div
                $(this).siblings('div').hide();
                //放大本div
                $(this).css({
                    'top':'0.2%',
                    'left':'0.2%',
                    'width':'99.7%',
                    'height':'99.7%'
                });
                cornerstone.resize(this);
            
            }else{
                    //缩小本div
                    $(this).css($(this).data('positionInfo'));
                    //显示其他div
                    $(this).siblings('div').show();
                    cornerstone.resize(this);
            }

        });
    }


    //渲染缩略图高亮
    function renderLightStudy(){

        //获取序列DOM元素
        let seriesDom = $('.seriescontent');
        //获取缩略图DOM元素
        let studyDom = $('.indeximgcontent');
        let seriesArr = [];
        _.forEach(seriesDom, (item) => {
            if($(item).data('seriesSort')!= undefined){
                seriesArr.push($(item).data('seriesSort'));
            }
        });
        seriesArr = _.uniq(seriesArr);
        //console.log(seriesArr);
        studyDom.removeClass('studyborder-primary-light');
        _.forEach(seriesArr, (item) => {
            $(studyDom.get(Number(item))).addClass('studyborder-primary-light');
        });
    }

    //重组数据结构
    function renderSeriesData(series, filesData) {
        dicomFileData = filesData; // 存储文件数据
    console.log('DICOM File Data:', dicomFileData); // 添加这行
    return _.map(series, (item) => ({
        currentImageIdIndex: 0,
        imageIds: item,
    }));
    }

    

    //加载序列
    function loadStackScroll(seriesarr,element){
        //需要先清除element  否则切换视角窗宽床尾会出现问题
        if($(element).find('canvas').length>0){
            cornerstone.disable(element);
        }
        cornerstone.enable(element);

        //重新深度复制对象
        let seriesarrnew = {
            currentImageIdIndex : 0,
            imageIds: seriesarr.imageIds
        };
        //初始化滑块
        if(!$(element).data('oneseriesflag')){
            //加载滑块
            let inst = slider.render({
                elem:  $(element).find('.elementscroll').get(0),
                min:0,
                max:seriesarrnew.imageIds.length-1,
                value: seriesarrnew.imageIds.length-1,
                type: 'vertical', // 垂直滑块
                tips: false,
                height:  $(element).height()-50,
                theme: '#000',
                change: function(value){
                    //console.log(6666)
                    //console.log(value)
                    if(isNaN(value) ){
                        return;
                    }
                    if((seriesarrnew.imageIds.length-seriesarrnew.currentImageIdIndex-1) != value){
                        //console.log(seriesarr.imageIds.length,value)
                        seriesarrnew.currentImageIdIndex = seriesarrnew.imageIds.length-value-1;
                        //console.log(seriesarr.currentImageIdIndex)
                        cornerstone.loadImage(seriesarrnew.imageIds[seriesarrnew.currentImageIdIndex]).then(function(image) {
                            cornerstone.displayImage(element, image);
                        });
                    }
                    

                }
            });
            sliderArr['slider'+$(element).index()] = inst;
        }

        initcornerstone.loadAndCacheImagePlus(seriesarrnew.imageIds[0],{ }).then(function(image) {
            cornerstone.displayImage(element, image);
            cornerstoneTools.addStackStateManager(element, ['stack','ReferenceLines']);
            cornerstoneTools.addToolState(element, 'stack', seriesarrnew);
        });
        //鼠标滚轮工具
        let stackScrollMouseWheel = cornerstoneTools['StackScrollMouseWheelTool'];
        //标尺工具
        let scaleOverlayTool = cornerstoneTools['ScaleOverlayTool'];
        //平移
        let PanTool = cornerstoneTools['PanTool'];
        //缩放
        let ZoomTool = cornerstoneTools['ZoomTool'];
        cornerstoneTools.addToolForElement(element,stackScrollMouseWheel);
        cornerstoneTools.addToolForElement(element,scaleOverlayTool);
        cornerstoneTools.addToolForElement(element,PanTool);
        cornerstoneTools.addToolForElement(element,ZoomTool);
        cornerstoneTools.setToolActiveForElement(element,'StackScrollMouseWheel', { });
        cornerstoneTools.setToolActiveForElement(element,'ScaleOverlay',{ });
        cornerstoneTools.setToolActiveForElement(element,'Pan',{mouseButtonMask: 4});
        cornerstoneTools.setToolActiveForElement(element,'Zoom',{mouseButtonMask: 2});
        

        $(element).on('cornerstoneimagerendered', function(e) {
            const eventData = e.detail;
            const stack = cornerstoneTools.getToolState(element, 'stack').data[0];
            renderContentText(element, eventData, stack, $(element).data('oneseriesflag') ? 2 : 1);
        });
        

        // let orientationMarkersTool = cornerstoneTools.OrientationMarkersTool;

        // cornerstoneTools.addTool(orientationMarkersTool)
        // cornerstoneTools.setToolActive('OrientationMarkers', { mouseButtonMask: 1 })
        if(currentToolName){
            console.log(currentToolName)
            cornerstoneTools.addToolForElement(element,cornerstoneTools[currentToolName+'Tool'])
            cornerstoneTools.setToolActiveForElement(element,currentToolName, { mouseButtonMask: 1 });
        }
       
    }

    //往cornerstoneTool中添加所有功能
    function addAllTool (){
        _.forEach(measureTools, (item) => {
            //console.log(item)
            //let tool = cornerstoneTools[(item+'Tool').toString()];
            cornerstoneTools.addTool(cornerstoneTools[(item+'Tool').toString()])
        })        
    }
    //完成旋转、镜像、复原等功能点击函数
    function viewTollEven(tollName){
        let element =  $('.seriesborder-primary-light').get(0);
        if(!$(element).data('oneseriesflag')){
            viewToll(element,tollName);
        }else{
            //复制给全局变量
            _.forEach(seriesElementsArr,(item) => {
                viewToll(item,tollName);
            })        
        }
      
    }

    //完成旋转、镜像、复原等功能
    function viewToll(element,tollName){
            passiveAllTool();
            let viewport = cornerstone.getViewport(element);
            if(tollName == 'rightRotate'){
                //console.log(viewport.rotation)
                viewport.rotation += 90;
                cornerstone.setViewport(element, viewport);
                //console.log(viewport.rotation)
            }else if(tollName == 'leftRotate'){
                //console.log(viewport.rotation)
                viewport.rotation -= 90;
                cornerstone.setViewport(element, viewport);
                //console.log(viewport.rotation)
            }else if(tollName == 'invert'){
                viewport.invert = !viewport.invert;
                cornerstone.setViewport(element, viewport);
            }else if(tollName == 'hflip'){
                viewport.hflip = !viewport.hflip;
                cornerstone.setViewport(element, viewport);
            }else if(tollName == 'vflip'){
                viewport.vflip = !viewport.vflip;
                cornerstone.setViewport(element, viewport);
            }else if(tollName == 'gray' || tollName == 'pet' || tollName == 'hsv' || tollName == 'jet'){
                let colormap = cornerstone.colors.getColormap(tollName);
                viewport.colormap = colormap;
                cornerstone.setViewport(element, viewport);
                //cornerstone.updateImage(element, true);
            }else if(tollName == 'reset'){
               
                // let colormap = cornerstone.colors.getColormap('gray');
                // viewport.colormap = colormap;
                // cornerstone.setViewport(element, viewport);
                // cornerstone.resize(element);
                cornerstone.reset(element);
                let updateViewport = cornerstone.getViewport(element);
                updateViewport.colormap = cornerstone.colors.getColormap('gray');
                cornerstone.setViewport(element, updateViewport);
               
            }
           
           
    }

    //激活某个功能
    function activeTool(toolName){
        console.log(toolName)
        console.log(cornerstoneTools)
        if(!catchTool[toolName]){
            cornerstoneTools.addTool(cornerstoneTools[toolName+'Tool'])
            //console.log(1111)
            catchTool[toolName] = true;
        }
        
        passiveAllTool();
       
        //鼠标滚轮和右键是固定操作
        
        
       
       
         cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 });
         currentToolName = toolName;
       
    }

    //禁止所有功能
    function passiveAllTool(){
        _.forEach(measureTools, (item) => {
            cornerstoneTools.setToolPassive(item, { mouseButtonMask: 1 });
        })  
        _.forEach(enableSetTools, (synchronizerName,toolName) => {
            //cornerstoneTools.removeTool(toolName);
            console.log(toolName,synchronizerName);
            cornerstoneTools.setToolDisabled(toolName, {
                synchronizationContext: synchronizerName,
              });
        })  
        //鼠标滚轮和右键是固定操作
         cornerstoneTools.removeTool('Pan');
         cornerstoneTools.removeTool('Zoom');
         cornerstoneTools.addTool(cornerstoneTools['PanTool']);
         cornerstoneTools.addTool(cornerstoneTools['ZoomTool']);
         cornerstoneTools.setToolActive('Zoom',{mouseButtonMask: 2});
         cornerstoneTools.setToolActive('Pan',{mouseButtonMask: 4});
         
    };

    //清除标记
    function clearAnno(toolName){
        if(toolName == 'clearTollState'){
            _.forEach(seriesElementsArr,(element) => {
                _.forEach(measureTools, (item) => {
                    cornerstoneTools.clearToolState(element, item);
                }); 
                cornerstone.updateImage(element);
            });
        }else if(toolName == 'nooperate'){
            passiveAllTool();
        }
       
       
    }

    function otherTool(toolName){
        passiveAllTool();
        if(toolName == 'ReferenceLines'){
            if(!catchTool[toolName]){
                cornerstoneTools.addTool(cornerstoneTools[toolName+'Tool']);
                //console.log(1111)
                catchTool[toolName] = true;

               
            }
            cornerstoneTools.setToolEnabled(toolName, {
                synchronizationContext: enableSetTools[toolName],
            });
            console.log(enableSetTools[toolName]);
            console.log(referenceLineSynchronizer);
            
            console.log(cornerstone.getEnabledElements());
            //cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 0 });
        
        }
    }

    

    var obj= { 
        initLayerClose:initLayerClose, 
        renderStudyImg:renderStudyImg,
        renderSeriesImg:renderSeriesImg,
        renderOneseriesImg:renderOneseriesImg,
        
        viewTollEven:viewTollEven,
        addAllTool:addAllTool,
        activeTool:activeTool,
        clearAnno:clearAnno,
        otherTool:otherTool,
        renderSeriesData: renderSeriesData,
        renderContentText: renderContentText,


    };
    exports("imgTools",obj);

})
