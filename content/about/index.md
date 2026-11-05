---
title: About
description: Research areas of the Statistical Data Science Lab at KAIST.
layout: about
research:
- title: Transfer learning for high-dimensional data
  color: '#285c9b'
  publication_topics:
  - High-dimension
  description: Modern data analysis often involves high-dimensional data where the dimensionality of the data
    is considerably high. Analysis of such high-dimensional data can be challenging in that many statistical
    models require a large sample size compared to dimensionality for accurate estimation and inference. However,
    along with target data of interest, we often may find an additional source dataset collected from another
    group with a large sample size. Our lab aims to develop methods which can improve the target data analysis
    results by leveraging such source data. For example, we have developed a transfer learning framework for
    high-dimensional covariance matrix estimation based on spectral similarity between target and source data.
    Through improvements in covariance estimation, we may expect enhancements in various downstream tasks such
    as PCA (principal component analysis), LDA (linear discriminant analysis), and network analysis.
  image: media/research/transfer-learning.png
  image_alt: Target and source data matrices with their spectral decompositions, illustrating shared structure
    for transfer learning.
- title: Compositional data analysis
  color: '#176a62'
  publication_topics:
  - Compositional data
  description: Compositional data consist of multivariate non-negative variables for which only relative information
    among components is meaningful, subject to a constant-sum constraint. Accordingly, compositional data are
    defined on a simplex rather than in a Euclidean space, which induces an inherent dependence structure among
    components. A common solution for this geometric constraint involves employing log-ratio transformations
    which map compositional data to a more tractable space. However, this approach encounters difficulties
    in the presence of zero components and may introduce distortions in the analysis results. Hence, our lab
    is working on developing methods to analyze compositional data with zeros without such limitations. For
    instance, we proposed a kernel density estimation method for compositional data with zeros which guarantees
    convergence to the true density. Also, we studied an interpretable dimension reduction technique and a
    mean estimation method for high-dimensional compositional data often encountered in microbiome research.
  image: media/research/compositional-data.png
  image_alt: Density contours on a triangular simplex, with a magnified view near its boundary.
- title: Synthetic data for data privacy
  color: '#991abc'
  publication_topics:
  - Data Privacy
  description: Modern machine learning increasingly relies on access to high-quality datasets, yet many valuable
    datasets cannot be broadly shared as they contain privacy-sensitive information about individuals. As a
    result, the demand for privacy-preserving data sharing techniques is growing, and synthetic data has emerged
    as a practical solution. Our lab studies synthetic data generation methods across diverse data types. We
    develop methods that produce high-utility synthetic datasets by preserving statistical fidelity, including
    key distributions, dependencies, and higher-order structure, while ensuring domain validity through constraint-satisfying
    and internally consistent samples. We also aim to reduce privacy risks such as membership inference and
    attribute disclosure, thereby balancing utility and privacy.
  image: media/research/synthetic-data.png
  image_alt: A scatter plot comparing original data with synthetic observations classified by disclosure risk.
labels:
  research_heading: Research Areas
  related_publications: View related publications
---
