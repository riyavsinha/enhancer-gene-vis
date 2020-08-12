import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HiGlassComponent } from 'higlass';
import { debounce, deepClone, isString, pipe } from '@flekschas/utils';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import ClearIcon from '@material-ui/icons/Clear';
import CssBaseline from '@material-ui/core/CssBaseline';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import InputLabel from '@material-ui/core/InputLabel';
import OutlinedInput from '@material-ui/core/OutlinedInput';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';

import SearchField from './SearchField';

import useQueryString from './use-query-string';
import { toAbsPosition } from './utils';
import {
  DEFAULT_X_DOMAIN_START,
  DEFAULT_X_DOMAIN_END,
  DEFAULT_VIEW_CONFIG,
  GENE_SEARCH_URL,
  VARIANT_SEARCH_URL,
} from './constants';

import 'higlass/dist/hglib.css';
import './Viewer.css';

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'absolute',
    display: 'flex',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  appBar: {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: drawerWidth,
    color: theme.palette.common.black,
    backgroundColor: theme.palette.common.white,
    boxShadow: `0 1px 0 0 ${theme.palette.grey['300']}`,
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
  },
  textInput: {
    minWidth: '100%',
  },
  toolbar: theme.mixins.toolbar,
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    padding: theme.spacing(1),
    backgroundColor: 'white',
  },
  higlass: {
    flexGrow: 1,
  },
}));

const DEFAULT_HIGLASS_OPTIONS = {
  sizeMode: 'bounded',
  // pixelPreciseMarginPadding: true,
  // containerPaddingX: 0,
  // containerPaddingY: 0,
  // viewMarginTop: 0,
  // viewMarginBottom: 6,
  // viewMarginLeft: 0,
  // viewMarginRight: 0,
  // viewPaddingTop: 3,
  // viewPaddingBottom: 3,
  // viewPaddingLeft: 0,
  // viewPaddingRight: 0,
};

const chrPosUrlEncoder = (chrPos) =>
  chrPos ? chrPos.replace(':', '.') : chrPos;

const chrPosUrlDecoder = (chrPos) =>
  chrPos ? chrPos.replace('.', ':') : chrPos;

const updateXDomainViewConfig = (newXDomainStart, newXDomainEnd) => (
  viewConfig
) => {
  const xDomain = [...viewConfig.views[0].initialXDomain];

  if (!Number.isNaN(+newXDomainStart)) {
    xDomain[0] = newXDomainStart;
  }
  if (!Number.isNaN(+newXDomainEnd)) {
    xDomain[1] = newXDomainEnd;
  }

  viewConfig.views[0].initialXDomain = xDomain;

  return viewConfig;
};

const updateFocusGeneViewConfig = (gene, start, end) => (viewConfig) => {
  const n = viewConfig.views[0].tracks.top.length;

  if (gene) {
    viewConfig.views[0].tracks.top[n - 1].options.focusGene = gene;
    viewConfig.views[0].overlays[1].options.extent = [[start, end]];
  } else {
    delete viewConfig.views[0].tracks.top[n - 1].options.focusGene;
    delete viewConfig.views[0].overlays[1].options.extent;
  }

  return viewConfig;
};

const updateFocusVariantViewConfig = (variantAbsPosition) => (viewConfig) => {
  // const n = viewConfig.views.length;

  const focusRegion = Number.isNaN(+variantAbsPosition)
    ? []
    : [variantAbsPosition - 0.5, variantAbsPosition + 0.5];

  viewConfig.views[0].tracks.top[2].options.focusRegion = focusRegion;
  viewConfig.views[0].tracks.top[4].options.focusRegion = focusRegion;
  // viewConfig.views[0].tracks.top[n - 1].options.focusRegion = focusRegion;
  viewConfig.views[0].overlays[0].options.extent = [focusRegion];

  // const focusDomain = Number.isNaN(+variantAbsPosition)
  //   ? viewConfig.views[1].initialXDomain
  //   : [variantAbsPosition - 500, variantAbsPosition + 500];

  // viewConfig.views[1].initialXDomain = focusDomain;
  // viewConfig.views[1].initialYDomain = focusDomain;

  return viewConfig;
};

const updateVariantYScaleViewConfig = (yScale) => (viewConfig) => {
  viewConfig.views[0].tracks.top[2].options.valueColumn =
    yScale === 'pValue' ? 7 : 8;
  // viewConfig.views[1].tracks.top[2].options.valueColumn =
  //   yScale === 'pValue' ? 7 : 8;

  return viewConfig;
};

const Viewer = (props) => {
  const [focusGene, setFocusGene] = useQueryString('gene', '');
  const [focusVariant, setFocusVariant] = useQueryString(
    'variant',
    'rs1250566'
  );
  const [variantYScale, setVariantYScale] = useQueryString(
    'varient-scale',
    'pValue'
  );
  const [xDomainStart, setXDomainStart] = useQueryString(
    'start',
    props.chromInfo.absToChr(DEFAULT_X_DOMAIN_START).slice(0, 2).join(':'),
    {
      encoder: chrPosUrlEncoder,
      decoder: chrPosUrlDecoder,
    }
  );
  const [xDomainEnd, setXDomainEnd] = useQueryString(
    'end',
    props.chromInfo.absToChr(DEFAULT_X_DOMAIN_END).slice(0, 2).join(':'),
    {
      encoder: chrPosUrlEncoder,
      decoder: chrPosUrlDecoder,
    }
  );

  const [focusGeneOption, setFocusGeneOption] = useState(null);
  const [focusVariantOption, setFocusVariantOption] = useState(null);
  const [options, setOptions] = useState(DEFAULT_HIGLASS_OPTIONS);

  const defaultViewConfig = pipe(
    updateFocusGeneViewConfig(
      focusGeneOption,
      focusGeneOption
        ? toAbsPosition(
            `${focusGeneOption.chr}:${focusGeneOption.txStart}`,
            props.chromInfo
          )
        : null,
      focusGeneOption
        ? toAbsPosition(
            `${focusGeneOption.chr}:${focusGeneOption.txEnd}`,
            props.chromInfo
          )
        : null
    ),
    updateFocusVariantViewConfig(
      focusVariantOption
        ? toAbsPosition(
            `${focusVariantOption.chr}:${focusVariantOption.txStart}`,
            props.chromInfo
          )
        : null
    ),
    updateVariantYScaleViewConfig(variantYScale),
    updateXDomainViewConfig(
      toAbsPosition(xDomainStart, props.chromInfo),
      toAbsPosition(xDomainEnd, props.chromInfo)
    )
  )(deepClone(DEFAULT_VIEW_CONFIG));

  const [viewConfig, setViewConfig] = useState(defaultViewConfig);
  const higlassApi = useRef(null);

  const updateFocusGeneInHiglass = (name, start, end) => {
    setViewConfig((currentViewConfig) =>
      updateFocusGeneViewConfig(name, start, end)(deepClone(currentViewConfig))
    );
  };

  const clearFocusGene = () => {
    setFocusGene('');
    setFocusGeneOption(null);
    updateFocusGeneInHiglass();
  };

  const focusGeneChangeHandler = (newValue) => {
    if (newValue) {
      setFocusGene(newValue.geneName);
      setFocusGeneOption(newValue);
      const start = toAbsPosition(
        `${newValue.chr}:${newValue.txStart}`,
        props.chromInfo
      );
      const end = toAbsPosition(
        `${newValue.chr}:${newValue.txEnd}`,
        props.chromInfo
      );
      updateFocusGeneInHiglass(newValue.geneName, start, end);
    } else {
      clearFocusGene();
    }
  };

  const updateFocusVariantInHiglass = (absPosition) => {
    setViewConfig((currentViewConfig) =>
      updateFocusVariantViewConfig(absPosition)(deepClone(currentViewConfig))
    );
  };

  const focusVariantChangeHandler = (newValue) => {
    if (newValue) {
      setFocusVariant(newValue.geneName);
      setFocusVariantOption(newValue);
      const absPosition = toAbsPosition(
        `${newValue.chr}:${newValue.txStart}`,
        props.chromInfo
      );
      updateFocusVariantInHiglass(absPosition);
    } else {
      clearFocusVariant();
    }
  };

  useEffect(() => {
    (async () => {
      if (focusGene && !focusGeneOption) {
        const r = await fetch(`${GENE_SEARCH_URL}&ac=${focusGene}`);
        const results = await r.json();
        focusGeneChangeHandler(results[0]);
      }
      if (focusVariant && !focusVariantOption) {
        const r = await fetch(`${VARIANT_SEARCH_URL}&ac=${focusVariant}`);
        const results = await r.json();
        focusVariantChangeHandler(results[0]);
      }
    })();
  }, []);

  const clearFocusVariant = () => {
    setFocusVariant('');
    updateFocusVariantInHiglass('');
  };

  const updateVariantYScaleInHiglass = (yScale) => {
    setViewConfig((currentViewConfig) =>
      updateVariantYScaleViewConfig(yScale)(deepClone(currentViewConfig))
    );
  };

  const variantYScaleChangeHandler = (event) => {
    setVariantYScale(event.target.value);
    updateVariantYScaleInHiglass(event.target.value);
  };

  const higlassClickHandler = (event) => {
    if (event.type === 'gene-annotation') {
      setFocusGene(event.payload.name);
      setFocusGeneOption({
        chr: event.payload.fields[0],
        txStart: event.payload.fields[1],
        txEnd: event.payload.fields[2],
        geneName: event.payload.name,
      });
      updateFocusGeneInHiglass(
        event.payload.name,
        event.payload.xStart,
        event.payload.xEnd
      );
    } else if (event.type === 'snp') {
      setFocusVariant(`${event.payload.fields[0]}:${event.payload.fields[1]}`);
      updateFocusVariantInHiglass(event.payload.xStart);
    }
  };

  const higlassLocationChangeHandler = (event) => {
    const [newXDomainStart, newXDomainEnd] = event.xDomain.map((absPos) =>
      props.chromInfo.absToChr(absPos).slice(0, 2).join(':')
    );
    setXDomainStart(newXDomainStart);
    setXDomainEnd(newXDomainEnd);
  };
  const higlassLocationChangeHandlerDb = debounce(
    higlassLocationChangeHandler,
    250
  );

  const higlassInitHandler = useCallback((higlassInstance) => {
    if (higlassInstance !== null) {
      higlassApi.current = higlassInstance.api;
      higlassInstance.api.on('click', higlassClickHandler);
      higlassInstance.api.on(
        'location',
        higlassLocationChangeHandlerDb,
        'context'
      );
    }
  }, []);

  const numericalXDomainStart =
    isString(xDomainStart) && xDomainStart.indexOf(':') >= 0
      ? props.chromInfo.chrToAbs([
          xDomainStart.split(':')[0],
          +xDomainStart.split(':')[1],
        ])
      : +xDomainStart;

  const numericalXDomainEnd =
    isString(xDomainEnd) && xDomainEnd.indexOf(':') >= 0
      ? props.chromInfo.chrToAbs([
          xDomainEnd.split(':')[0],
          +xDomainEnd.split(':')[1],
        ])
      : +xDomainEnd;

  const xDomainStartChangeHandler = (event) => {
    setXDomainStart(event.target.value);
  };

  const xDomainEndChangeHandler = (event) => {
    setXDomainEnd(event.target.value);
  };

  const updateXDomain = (event) => {
    if (!higlassApi.current) return;

    const newViewConfig = deepClone(viewConfig);

    const xDomain = [...newViewConfig.views[0].initialXDomain];

    if (!Number.isNaN(+numericalXDomainStart)) {
      xDomain[0] = numericalXDomainStart;
    }
    if (!Number.isNaN(+numericalXDomainEnd)) {
      xDomain[1] = numericalXDomainEnd;
    }

    higlassApi.current.zoomTo(
      'context',
      xDomain[0],
      xDomain[1],
      xDomain[0],
      xDomain[1],
      2000
    );
  };

  const classes = useStyles();

  return (
    <div className={classes.root}>
      <CssBaseline />
      <AppBar position="fixed" className={classes.appBar}>
        <Toolbar>
          <Typography variant="h6" noWrap>
            Enhancer-Promoter Vis
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        className={classes.drawer}
        variant="permanent"
        classes={{
          paper: classes.drawerPaper,
        }}
        anchor="left"
      >
        <div className={classes.toolbar} />
        <Divider />
        <Box m={1}>
          <Box m={0}>
            <FormControl variant="outlined" margin="dense" fullWidth>
              <InputLabel htmlFor="x-domain-start">Region Start</InputLabel>
              <OutlinedInput
                id="x-domain-start"
                label="Region Start"
                onChange={xDomainStartChangeHandler}
                value={xDomainStart}
              />
            </FormControl>
          </Box>
          <Box m={0}>
            <FormControl variant="outlined" margin="dense" fullWidth>
              <InputLabel htmlFor="x-domain-end">Region End</InputLabel>
              <OutlinedInput
                id="x-domain-end"
                label="Region End"
                onChange={xDomainEndChangeHandler}
                value={xDomainEnd}
              />
            </FormControl>
          </Box>
          <Box m={0}>
            <Button
              variant="contained"
              margin="dense"
              onClick={updateXDomain}
              fullWidth
              disableElevation
            >
              Go
            </Button>
          </Box>
        </Box>
        <Divider />
        <Box m={1}>
          <Box m={0}>
            <FormControl variant="outlined" margin="dense" fullWidth>
              <SearchField
                label="Focus Gene"
                searchUrl={GENE_SEARCH_URL}
                onChange={focusGeneChangeHandler}
                value={focusGeneOption}
                fullWidth
              />
            </FormControl>
          </Box>
          <Box m={0}>
            <FormControl variant="outlined" margin="dense" fullWidth>
              <SearchField
                label="Focus Variant"
                searchUrl={VARIANT_SEARCH_URL}
                onChange={focusVariantChangeHandler}
                value={focusVariantOption}
                fullWidth
              />
            </FormControl>
          </Box>
        </Box>
        <Box m={1}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Variant y-scale</FormLabel>
            <RadioGroup
              aria-label="variantYScale"
              name="variantYScale"
              value={variantYScale}
              onChange={variantYScaleChangeHandler}
            >
              <FormControlLabel
                label="p-value"
                control={<Radio size="small" />}
                value="pValue"
              />
              <FormControlLabel
                label="Posterior probability"
                control={<Radio size="small" />}
                value="posteriorProbability"
              />
            </RadioGroup>
          </FormControl>
        </Box>
      </Drawer>
      <main className={classes.content}>
        <div className={classes.toolbar} />
        <div className={classes.higlass}>
          <HiGlassComponent
            ref={higlassInitHandler}
            viewConfig={viewConfig}
            options={options}
          />
        </div>
      </main>
    </div>
  );
};

export default Viewer;
